Bun.serve({
  port: 3000,
  routes: {
    "/": {
      GET: () => {
        return new Response(
          "Super8 Camera Effect API\n\nPOST /api/process - Process video with super8 effect",
          {
            headers: { "Content-Type": "text/plain" },
          }
        );
      },
    },
    "/api/process": {
      GET: async (req) => {
        try {
          console.log("Starting super8 processing...");

          // Run the super8.sh script using Bun's shell
          const proc = Bun.$`bash super8.sh`;
          const result = await proc;

          console.log("Processing complete!");

          return new Response(
            JSON.stringify({
              success: true,
              message: "Video processing complete",
              output: "output/output.mov",
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Error processing video:", error);
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
  },
});

console.log("Server running on http://localhost:3000");
