package expo.modules.snarnavigation

import android.Manifest
import android.content.pm.PackageManager
import android.speech.tts.TextToSpeech
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.mapbox.common.MapboxOptions
import com.mapbox.geojson.LineString
import com.mapbox.geojson.Point
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.MapboxNavigationProvider
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.trip.session.BannerInstructionsObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver
import com.mapbox.navigation.core.trip.session.VoiceInstructionsObserver
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

/** One navigation session, owned by the Driver trip UI. No simulated positions. */
class SnarNavigationModule : Module() {
  private var navigation: MapboxNavigation? = null
  private var speech: TextToSpeech? = null
  private var speechReady = false
  private var muted = false
  private var generation = 0
  private var sessionId = ""

  private fun emit(name: String, data: Map<String, Any?>) {
    sendEvent(name, data + mapOf("sessionId" to sessionId))
  }
  private val routes = RoutesObserver { result ->
    val route = result.navigationRoutes.firstOrNull()?.directionsRoute
    val geometry = route?.geometry()
    if (geometry != null) {
      speech?.stop()
      emit("onRoute", mapOf("coordinates" to LineString.fromPolyline(geometry, 6)
        .coordinates().map { listOf(it.longitude(), it.latitude()) }))
    }
  }
  private val progress = RouteProgressObserver { p ->
    emit("onProgress", mapOf("distanceRemaining" to p.distanceRemaining,
      "durationRemaining" to p.durationRemaining, "state" to p.currentState.toString()))
  }
  private val banner = BannerInstructionsObserver { instruction ->
    emit("onInstruction", mapOf("instruction" to instruction.primary().text()))
  }
  private val voice = VoiceInstructionsObserver { instruction ->
    val message = instruction.announcement()
    if (!muted && speechReady && !message.isNullOrBlank()) {
      speech?.speak(message, TextToSpeech.QUEUE_FLUSH, null, "snar-turn")
    }
  }

  private fun stop() {
    generation++
    navigation?.let {
      it.unregisterRoutesObserver(routes)
      it.unregisterRouteProgressObserver(progress)
      it.unregisterBannerInstructionsObserver(banner)
      it.unregisterVoiceInstructionsObserver(voice)
      it.stopTripSession()
      it.setNavigationRoutes(emptyList())
    }
    if (navigation != null) MapboxNavigationProvider.destroy()
    navigation = null
    speech?.stop()
    speech?.shutdown()
    speech = null
    speechReady = false
    muted = false
    sessionId = ""
  }

  override fun definition() = ModuleDefinition {
    Name("SnarNavigation")
    Events("onRoute", "onProgress", "onInstruction", "onError")
    AsyncFunction("start") { id: String, token: String, coordinates: List<List<Double>> ->
      val context = appContext.reactContext ?: error("Driver er ikke klar")
      check(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        == PackageManager.PERMISSION_GRANTED) { "Nøyaktig posisjon må være aktivert" }
      require(token.startsWith("pk.")) { "Mapbox er ikke konfigurert" }
      require(coordinates.size in 2..25 && coordinates.all { it.size == 2 &&
        it[0].isFinite() && it[1].isFinite() && it[0] in -180.0..180.0 && it[1] in -90.0..90.0 })
      stop()
      sessionId = id
      val requestGeneration = generation
      MapboxOptions.accessToken = token
      speech = TextToSpeech(context) { status ->
        if (requestGeneration == generation) {
          speechReady = status == TextToSpeech.SUCCESS
          if (speechReady) speech?.language = Locale.forLanguageTag("nb-NO")
        }
      }
      val nav = MapboxNavigationProvider.create(NavigationOptions.Builder(context).build())
      navigation = nav
      nav.registerRoutesObserver(routes)
      nav.registerRouteProgressObserver(progress)
      nav.registerBannerInstructionsObserver(banner)
      nav.registerVoiceInstructionsObserver(voice)
      // The SDK supplies real location matching, route progress and automatic rerouting.
      nav.startTripSession()
      nav.requestRoutes(RouteOptions.builder().applyDefaultNavigationOptions()
        .language("nb").voiceUnits("metric")
        .coordinatesList(coordinates.map { Point.fromLngLat(it[0], it[1]) }).build(),
        object : NavigationRouterCallback {
          override fun onRoutesReady(routes: List<NavigationRoute>, routerOrigin: String) {
            if (requestGeneration == generation && navigation === nav) nav.setNavigationRoutes(routes)
          }
          override fun onFailure(reasons: List<RouterFailure>, routeOptions: RouteOptions) {
            if (requestGeneration == generation) {
              nav.stopTripSession()
              emit("onError", mapOf("message" to
                "Kunne ikke beregne kjøreruten. Prøv igjen eller åpne ekstern navigasjon."))
            }
          }
          override fun onCanceled(routeOptions: RouteOptions, routerOrigin: String) = Unit
        })
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { stop() }.runOnQueue(Queues.MAIN)
    AsyncFunction("setMuted") { value: Boolean ->
      muted = value
      if (muted) speech?.stop()
    }.runOnQueue(Queues.MAIN)
    OnDestroy { Handler(Looper.getMainLooper()).post { stop() } }
  }
}
