import indexHtml from "./index.html";
import { mkdir, readdir, unlink, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Configuration
const UPLOAD_DIR = "./uploads";
const OUTPUT_DIR = "./output";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_VIDEO_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
const CLEANUP_INTERVAL = 15 * 60 * 1000; // Run cleanup every 15 minutes

// Ensure directories exist
if (!existsSync(UPLOAD_DIR)) {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

if (!existsSync(OUTPUT_DIR)) {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

// Cleanup function to remove old files
async function cleanupOldFiles() {
  const now = Date.now();
  let cleanedCount = 0;

  try {
    // Clean up old output videos
    const outputFiles = await readdir(OUTPUT_DIR);
    for (const file of outputFiles) {
      const filePath = join(OUTPUT_DIR, file);
      const stats = await stat(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > MAX_VIDEO_AGE) {
        await unlink(filePath);
        cleanedCount++;
        console.log(`Deleted old output file: ${file}`);
      }
    }

    // Clean up any orphaned upload files
    const uploadFiles = await readdir(UPLOAD_DIR);
    for (const file of uploadFiles) {
      const filePath = join(UPLOAD_DIR, file);
      const stats = await stat(filePath);
      const fileAge = now - stats.mtimeMs;

      // Delete upload files older than 10 minutes (they should have been processed)
      if (fileAge > 10 * 60 * 1000) {
        await unlink(filePath);
        cleanedCount++;
        console.log(`Deleted orphaned upload file: ${file}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleanup complete: removed ${cleanedCount} old files`);
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Run cleanup on startup
await cleanupOldFiles();

// Schedule periodic cleanup
setInterval(cleanupOldFiles, CLEANUP_INTERVAL);

Bun.serve({
  port: 3000,
  routes: {
    "/": indexHtml,
    "/api/process": {
      POST: async (req) => {
        let uploadPath = "";

        try {
          console.log("Receiving video upload...");

          const formData = await req.formData();
          const videoFile = formData.get("video") as File;

          if (!videoFile) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "No video file provided",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Validate file size
          if (videoFile.size > MAX_FILE_SIZE) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `File size exceeds maximum allowed size of ${
                  MAX_FILE_SIZE / 1024 / 1024
                }MB`,
              }),
              {
                status: 413,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Generate unique ID for this video
          const videoId = `${Date.now()}-${Math.random()
            .toString(36)
            .substring(7)}`;
          uploadPath = join(UPLOAD_DIR, `${videoId}.mov`);
          const outputPath = join(OUTPUT_DIR, `${videoId}.mov`);

          // Save uploaded file
          console.log("Saving uploaded file...");
          await Bun.write(uploadPath, videoFile);

          console.log("Starting super8 processing...");

          // Run the super8.sh script with the uploaded video
          const proc = Bun.$`bash super8.sh ${uploadPath} ${outputPath}`;
          await proc;

          console.log("Processing complete!");

          // Clean up uploaded file after successful processing
          try {
            await unlink(uploadPath);
            console.log(`Deleted uploaded file: ${uploadPath}`);
          } catch (cleanupError) {
            console.error("Error deleting upload file:", cleanupError);
            // Don't fail the request if cleanup fails
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Video processing complete",
              videoId: videoId,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Error processing video:", error);

          // Clean up uploaded file if processing failed
          if (uploadPath && existsSync(uploadPath)) {
            try {
              await unlink(uploadPath);
              console.log(`Deleted failed upload file: ${uploadPath}`);
            } catch (cleanupError) {
              console.error("Error deleting failed upload file:", cleanupError);
            }
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
    "/api/video/:id": {
      GET: async (req) => {
        const videoId = req.params.id;
        const videoPath = join(OUTPUT_DIR, `${videoId}.mov`);

        if (!existsSync(videoPath)) {
          return new Response("Video not found", { status: 404 });
        }

        const file = Bun.file(videoPath);
        return new Response(file, {
          headers: {
            "Content-Type": "video/quicktime",
            "Accept-Ranges": "bytes",
          },
        });
      },
    },
    "/api/cleanup": {
      GET: async () => {
        try {
          await cleanupOldFiles();
          return new Response(
            JSON.stringify({
              success: true,
              message: "Cleanup completed successfully",
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Cleanup failed",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Server running on http://localhost:3000");
