const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parse(function (err) {
  if (err) {
    console.error('Error parsing project:', err);
    process.exit(1);
  }

  console.log('Project parsed successfully!');

  // Check if target already exists
  const targets = myProj.pbxNativeTargetSection();
  for (let k in targets) {
    const t = targets[k];
    if (t && t.name && t.name.replace(/["']/g, '') === 'WorkoutLiveActivity') {
      console.log('WorkoutLiveActivity target already exists!');
      return;
    }
  }

  const appTargetUuid = '504EC3031FED79650016851F';
  const appTarget = targets[appTargetUuid];
  if (!appTarget) {
    console.error('App target not found!');
    process.exit(1);
  }

  // 1. Add Target
  const target = myProj.addTarget(
    'WorkoutLiveActivity',
    'app_extension',
    'WorkoutLiveActivity',
    'lt.manodrabuziai.fr.ZCU3WN2ZW4.WorkoutLiveActivity'
  );
  console.log('Target added with UUID:', target.uuid);

  // 2. Add build phases to the new target
  const sourcesPhase = myProj.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  const frameworksPhase = myProj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  const resourcesPhase = myProj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);

  // 3. Add Source files to WorkoutLiveActivity
  myProj.addSourceFile('WorkoutLiveActivity/WorkoutActivityAttributes.swift', { target: target.uuid }, 'WorkoutLiveActivity');
  myProj.addSourceFile('WorkoutLiveActivity/WorkoutLiveActivityWidget.swift', { target: target.uuid }, 'WorkoutLiveActivity');
  myProj.addSourceFile('WorkoutLiveActivity/WorkoutWidgetBundle.swift', { target: target.uuid }, 'WorkoutLiveActivity');

  // 4. Add WorkoutActivityAttributes.swift to App target
  myProj.addSourceFile('App/WorkoutActivityAttributes.swift', { target: appTargetUuid }, 'App');

  // 5. Add Frameworks
  myProj.addFramework('ActivityKit.framework', { target: target.uuid });
  myProj.addFramework('WidgetKit.framework', { target: target.uuid });
  myProj.addFramework('SwiftUI.framework', { target: target.uuid });

  // 6. Ensure target dependency sections exist
  if (!myProj.hash.project.objects['PBXTargetDependency']) {
    myProj.hash.project.objects['PBXTargetDependency'] = {};
  }
  if (!myProj.hash.project.objects['PBXContainerItemProxy']) {
    myProj.hash.project.objects['PBXContainerItemProxy'] = {};
  }
  myProj.addTargetDependency(appTargetUuid, [target.uuid]);

  // 7. Embed App Extension into App.app/PlugIns (dstSubfolderSpec: 13)
  const copyPhase = myProj.addBuildPhase(
    ['WorkoutLiveActivity.appex'],
    'PBXCopyFilesBuildPhase',
    'Embed App Extensions',
    appTargetUuid,
    'app_extension'
  );
  if (copyPhase && copyPhase.buildPhase && copyPhase.buildPhase.files && copyPhase.buildPhase.files[0]) {
    const bfUuid = copyPhase.buildPhase.files[0].value;
    const bf = myProj.pbxBuildFileSection()[bfUuid];
    if (bf) {
      bf.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
    }
  }

  // 8. Update Build Settings for WorkoutLiveActivity
  const configList = myProj.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  const configs = myProj.pbxXCBuildConfigurationSection();
  for (let c of configList.buildConfigurations) {
    const config = configs[c.value];
    if (config && config.buildSettings) {
      config.buildSettings.SWIFT_VERSION = '5.0';
      config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.1';
      config.buildSettings.DEVELOPMENT_TEAM = 'ZCU3WN2ZW4';
      config.buildSettings.CODE_SIGN_STYLE = 'Manual';
      config.buildSettings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
      config.buildSettings.PROVISIONING_PROFILE_SPECIFIER = '"Vyta Workout Widget Profile"';
      config.buildSettings.INFOPLIST_FILE = 'WorkoutLiveActivity/WorkoutLiveActivity-Info.plist';
      config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = 'lt.manodrabuziai.fr.ZCU3WN2ZW4.WorkoutLiveActivity';
      config.buildSettings.PRODUCT_NAME = 'WorkoutLiveActivity';
      config.buildSettings.MARKETING_VERSION = '1.0';
      config.buildSettings.CURRENT_PROJECT_VERSION = '1';
      config.buildSettings.TARGETED_DEVICE_FAMILY = '"1"';
      config.buildSettings.SKIP_INSTALL = 'YES';
      config.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
    }
  }

  // 9. Update Build Settings for App target (manual signing specifier)
  const appConfigList = myProj.pbxXCConfigurationList()[appTarget.buildConfigurationList];
  for (let c of appConfigList.buildConfigurations) {
    const config = configs[c.value];
    if (config && config.buildSettings) {
      config.buildSettings.DEVELOPMENT_TEAM = 'ZCU3WN2ZW4';
      config.buildSettings.CODE_SIGN_STYLE = 'Manual';
      config.buildSettings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
      config.buildSettings.PROVISIONING_PROFILE_SPECIFIER = '"Vyta TestFlight AppStore Profile"';
    }
  }

  // Write directly to project.pbxproj
  fs.writeFileSync(projectPath, myProj.writeSync());
  console.log('Configured project.pbxproj successfully!');
});
