// Reference helpers (the content script inlines its own copies for MV3 isolation).
export function detectSite(hostname) {
  if (hostname.includes("amazon")) return "amazon";
  if (hostname.includes("flipkart")) return "flipkart";
  if (hostname.includes("myntra")) return "myntra";
  return null;
}

export const SELECTORS = {
  amazon:   { title: "#productTitle", price: ".a-price .a-offscreen" },
  flipkart: { title: "span.B_NuCI",   price: "div._30jeq3" },
  myntra:   { title: "h1.pdp-title",  price: "span.pdp-price strong" },
};
