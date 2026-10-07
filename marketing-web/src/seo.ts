import { PUBLIC_SITE_URL } from "./siteConfig";

type SeoConfig = {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  image?: string;
};

const DEFAULT_IMAGE = `${PUBLIC_SITE_URL}/assets/figma/passenger.png`;

function ensureMeta(selector: string, attribute: "name" | "property", key: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  return element;
}

function ensureCanonical() {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  return link;
}

export function setPageSeo({
  title,
  description,
  canonical,
  robots = "index,follow",
  image = DEFAULT_IMAGE,
}: SeoConfig) {
  document.title = title;
  ensureMeta('meta[name="description"]', "name", "description").content = description;
  ensureMeta('meta[name="robots"]', "name", "robots").content = robots;
  ensureCanonical().href = canonical;

  const properties: Record<string, string> = {
    "og:title": title,
    "og:description": description,
    "og:url": canonical,
    "og:type": "website",
    "og:image": image,
    "og:image:alt": "SNAR reiseplattform",
    "og:site_name": "SNAR",
    "og:locale": "nb_NO",
  };

  Object.entries(properties).forEach(([property, content]) => {
    ensureMeta(`meta[property="${property}"]`, "property", property).content = content;
  });

  const names: Record<string, string> = {
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image,
  };

  Object.entries(names).forEach(([name, content]) => {
    ensureMeta(`meta[name="${name}"]`, "name", name).content = content;
  });
}
