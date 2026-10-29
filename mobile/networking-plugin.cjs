const fs = require('node:fs');
const path = require('node:path');
const {withMainApplication,withDangerousMod} = require('expo/config-plugins');
const marker = '// TCG ROYAL bounded network connections';
function applyNetworking(source) {
  if (source.includes(marker)) return source;
  const packages = 'PackageList(this).packages.apply {';
  const onCreate = '    super.onCreate()';
  if (!source.includes(packages) || !source.includes(onCreate) || !source.includes('loadReactNative(this)'))
    throw Error('Unrecognized MainApplication template; refusing to omit network configuration');
  return source.replace(packages, packages+'\n          add(com.tcgroyal.lending.preview.network.TcgNetworkPackage())')
    .replace(onCreate, onCreate+`\n    ${marker}
    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory(
      com.facebook.react.modules.network.OkHttpClientFactory {
        com.tcgroyal.lending.preview.network.TcgHttpClients.create(
          com.facebook.react.modules.network.OkHttpClientProvider.createClientBuilder(applicationContext)
        )
      }
    )`);
}
function withTcgNetworking(config) {
  if(config.android?.package!=='com.tcgroyal.lending.preview')throw Error('Networking plugin is restricted to the Preview package');
  config=withMainApplication(config,mod=>{mod.modResults.contents=applyNetworking(mod.modResults.contents);return mod});
  return withDangerousMod(config,['android',async mod=>{
    const target=path.join(mod.modRequest.platformProjectRoot,'app/src/main/java/com/tcgroyal/lending/preview/network');
    fs.mkdirSync(target,{recursive:true});
    for(const file of ['TcgHttpClients.java','TcgNetworkModule.java','TcgNetworkPackage.java'])
      fs.copyFileSync(path.join(__dirname,'native-network',file),path.join(target,file));
    return mod;
  }]);
}
module.exports={applyNetworking,withTcgNetworking};
