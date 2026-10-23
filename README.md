# Roadster 2.0 — 推进实验室

基于 Vite 8 和 three.js 的本地 3D 展示网站，展示 Tesla Roadster 2020 概念版模型。
可以在premier-tan-mva4qbs8.edgeone.dev中查看

## 开始使用

在项目根目录运行：

```bash
npm ci
npm run dev
```

依赖已安装时可直接运行 `npm run dev`。在浏览器打开终端显示的 Local 地址，默认通常是 `http://localhost:5173/`。

```bash
npm run build     # 生成 dist/
npm run preview   # 本地预览构建结果
```

需要支持 WebGL 2 的现代浏览器。模型、贴图、Meshopt 解码器、字体均由本地项目提供，正常运行无需外部素材服务。

## 交互

- 鼠标左键拖动 / 单指拖动：旋转视角。
- 鼠标滚轮 / 双指缩放 /「画面缩放」滑条：调整镜头距离。
- 前侧、车尾、俯视按钮：平滑切换预设镜头；重置按钮回到前侧。
- 车身配色：烈焰红、冰川银、曜石黑。
- 后向推进：控制两个后部喷口的喷流长度、亮度和粒子。
- 侧向喷气：控制左右两个侧喷口。
- 垂直升力：控制四个底部喷口和车身悬浮高度。
- 一键演示：应用后向 85%、侧向 50%、升力 60%，并切换车尾镜头。
- 全部归零：关闭所有喷流，车身平稳落回展台。

**喷口、喷流和悬浮是为本网站添加的概念可视化，不代表 Tesla 的实际工程设计、车辆配置或性能。** 网站为独立演示，并非 Tesla 官方网站。

## 文件结构

```text
index.html                   页面结构、滑条和按钮
src/main.js                  页面事件、滑条数值、加载状态
src/scene.js                 模型加载、材质、摄影棚、相机与渲染
src/thrusters.js             八个喷口、渐变喷流和粒子 shader
src/style.css                桌面与移动端布局
public/models/roadster.glb    本地 Roadster 模型（含贴图，约 3.5 MB）
public/models/ATTRIBUTION.md  模型来源、授权和修改说明
public/fonts/                本地 Barlow Condensed 字体与 OFL 授权
public/favicon.svg           网站图标
package.json                 运行依赖与开发命令
package-lock.json            依赖版本锁文件
```

## 模型与字体来源

- 模型：**Tesla Roadster 2020 | www.vecarz.com**，作者 [vecarz](https://sketchfab.com/heynic)，[原作品](https://sketchfab.com/3d-models/tesla-roadster-2020-wwwvecarzcom-fac3d813620f4c4a95da1933c2592069)。原始 GLB 的 `asset.extras` 标注 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，并保留作者、来源和授权信息；详见 `public/models/ATTRIBUTION.md`。
- 下载镜像：[Vivekkk-1/3D-Models](https://github.com/Vivekkk-1/3D-Models/blob/main/Cars/tesla_roadster_2020.glb)。实际模型作者和许可证以上述模型内嵌信息为准，不使用镜像仓库的代码许可证替代素材许可证。
- 字体：Google Fonts 的 **Barlow Condensed SemiBold**，SIL Open Font License 1.1；授权副本位于 `public/fonts/OFL-BarlowCondensed.txt`。正文使用系统字体。
- 光照环境由 three.js 的 `RoomEnvironment` 在本地生成；喷流、喷口、粒子和图标由本项目生成。

模型原文件约 26.7 MB，使用 glTF Transform 4.5.1 进行几何数据压缩和 WebP 贴图优化，保留原始几何细节和独立材质。处理命令：

```bash
npx --yes @gltf-transform/cli@4.5.1 optimize 原始模型.glb public/models/roadster.glb --compress meshopt --texture-size 1024 --texture-compress webp --palette false --simplify false
```

使用 `MeshoptDecoder` 本地解码；请保留页面署名和素材授权文件。

## 开发与验证

场景模块包含资源清理和 Vite 热更新清理逻辑。页面不可见时暂停动画。

开发时可通过页面实际加载的 `src/main.js` 模块导出的 `inspectExperience()` 查看镜头、车漆材质和喷口的实时状态。无需给 `window` 添加全局对象。

不要将 `node_modules/`、`dist/`、`.DS_Store` 或日志提交到版本管理。仓库初始化、提交和上传由你自行管理。
