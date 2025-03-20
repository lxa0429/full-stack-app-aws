import fs from "fs";
import path from "path";
import Jimp from "jimp";

// filterImageFromURL
export async function filterImageFromURL(inputURL) {
  try {
    console.log("🔄 Fetching image from URL:", inputURL);

    const photo = await Jimp.read(inputURL);
    console.log("✅ Image loaded successfully!");

    // Ensure the /tmp directory exists
    const tmpDir = "/tmp";
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const outpath = path.join(tmpDir, `filtered.${Date.now()}.jpg`);
    console.log("📝 Saving filtered image at:", outpath);

    await photo
      .resize(256, 256)
      .quality(60)
      .greyscale()
      .writeAsync(outpath);

    console.log("✅ Image processing complete!");
    return outpath;
  } catch (error) {
    console.error("❌ Error processing image:", error);
    throw new Error("Unable to process the image.");
  }
}

// delete Local Files
export async function deleteLocalFiles(files) {
  for (let file of files) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log("🗑️ Deleted:", file);
      }
    } catch (error) {
      console.error("⚠️ Error deleting file:", file, error);
    }
  }
}
