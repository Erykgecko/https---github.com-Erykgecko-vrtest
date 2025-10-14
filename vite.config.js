import basicSsl from '@vitejs/plugin-basic-ssl';

export default {
  //plugins: [basicSsl()],
  base: 'vrtest',
  server: {
    https: true,      // secure context required by WebXR
    host: true,       // expose to LAN (Quest can open via your PC's IP)
    port: 5173
  },
};