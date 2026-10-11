"""Policy regressions: docs bypass is narrow and customer/driver lanes cannot cross."""
import unittest
from copy import deepcopy
import internal_ride_testing as policy


class RideTestingPolicyTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "KJAPP_INTERNAL_RIDE_TEST_ENABLED": "true",
            "STRIPE_SECRET_KEY": "sk_test_unit",
            "KJAPP_INTERNAL_RIDE_TEST_CUSTOMER_IDS": "c1",
            "KJAPP_INTERNAL_RIDE_TEST_DRIVER_IDS": "d1,d2",
        }
        self.driver = {"_id": "d1", "role": "driver", "internal_test_account": True,
                       "approved": True, "fleet_id": "f1", "vehicle_id": "v1"}
        self.fleet = {"_id": "f1", "internal_test_fleet": True, "status": "active"}
        self.vehicle = {"_id": "v1", "internal_test_vehicle": True, "active": True,
                        "fleet_id": "f1", "assigned_driver_id": "d1"}

    def test_disabled_by_default_and_live_stripe_key(self):
        self.assertFalse(policy.enabled({}))
        for key in ("", "sk_live_never", "rk_test_unsupported"):
            env = {**self.env, "STRIPE_SECRET_KEY": key}
            self.assertFalse(policy.enabled(env))

    def test_flag_and_both_allowlists_required(self):
        for key in ("KJAPP_INTERNAL_RIDE_TEST_ENABLED",
                    "KJAPP_INTERNAL_RIDE_TEST_CUSTOMER_IDS", "KJAPP_INTERNAL_RIDE_TEST_DRIVER_IDS"):
            self.assertFalse(policy.enabled({**self.env, key: ""}))

    def test_exact_assigned_internal_test_driver_is_allowed(self):
        self.assertTrue(policy.driver_allowed(self.driver, self.fleet, self.vehicle, self.env))

    def test_real_unlisted_suspended_and_wrong_role_drivers_are_rejected(self):
        for field, value in [("_id", "outsider"), ("role", "user"),
                             ("internal_test_account", False), ("approved", False),
                             ("disabled", True), ("fleet_active", False),
                             ("vehicle_id", "other")]:
            with self.subTest(field=field):
                driver = {**self.driver, field: value}
                self.assertFalse(policy.driver_allowed(driver, self.fleet, self.vehicle, self.env))

    def test_fleet_and_vehicle_scope_fail_closed(self):
        for field, value in [("_id", "other"), ("internal_test_fleet", False), ("status", "suspended")]:
            self.assertFalse(policy.driver_allowed(self.driver, {**self.fleet, field: value}, self.vehicle, self.env))
        for field, value in [("_id", "other"), ("internal_test_vehicle", False),
                             ("active", False), ("fleet_id", "other"), ("assigned_driver_id", "d2")]:
            self.assertFalse(policy.driver_allowed(self.driver, self.fleet, {**self.vehicle, field: value}, self.env))

    def test_cross_lane_acceptance_is_rejected(self):
        self.assertTrue(policy.trip_allowed(False, "normal", self.env))
        self.assertTrue(policy.trip_allowed(True, "c1", self.env))
        self.assertFalse(policy.trip_allowed(True, "normal", self.env))
        self.assertFalse(policy.trip_allowed(False, "c1", self.env))
        self.assertFalse(policy.trip_allowed(True, "c1", {**self.env, "KJAPP_INTERNAL_RIDE_TEST_ENABLED": "false"}))

    def test_disabled_test_supply_cannot_fall_through_to_real_drivers(self):
        self.assertEqual(policy.driver_supply_filter(True, {}), {"_id": {"$in": []}})
        self.assertEqual(policy.driver_supply_filter(False, self.env),
                         {"internal_test_account": {"$ne": True}})
        self.assertEqual(policy.driver_supply_filter(True, self.env), {"internal_test_account": True})

    def test_broadcast_pending_is_separated_in_both_directions(self):
        self.assertEqual(policy.pending_customer_filter(True, self.env), {"user_id": {"$in": ["c1"]}})
        self.assertEqual(policy.pending_customer_filter(False, self.env), {"user_id": {"$nin": ["c1"]}})

    def test_policy_never_sets_document_or_identity_approval(self):
        before = deepcopy((self.driver, self.fleet, self.vehicle))
        policy.driver_allowed(self.driver, self.fleet, self.vehicle, self.env)
        self.assertEqual(before, (self.driver, self.fleet, self.vehicle))


if __name__ == "__main__":
    unittest.main()
