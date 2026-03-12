import dotenv from "dotenv";
import ImageKit from "@imagekit/nodejs";

dotenv.config();

const requiredKeys = [
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.warn(`Missing ${key}. Image upload routes will fail until configured.`);
  }
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
});

export default imagekit;
