import { createServer } from "vite";
import { ViteNodeRunner } from "vite-node/client";
import { ViteNodeServer } from "vite-node/server";
import { installSourcemapsSupport } from "vite-node/source-map";

const server = await createServer({
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});

const node = new ViteNodeServer(server, {
  deps: {
    inline: ["isomorphic-git"],
  },
});

// fixes stacktraces in Errors
installSourcemapsSupport({
  getSourceMap: (source) => node.getSourceMap(source),
});

const runner = new ViteNodeRunner({
  root: server.config.root,
  base: server.config.base,
  fetchModule(id) {
    return node.fetchModule(id);
  },
  resolveId(id, importer) {
    return node.resolveId(id, importer);
  },
});

await runner.executeFile(process.argv[2]);

await server.close();
