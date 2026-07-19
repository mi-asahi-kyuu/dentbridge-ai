import {Composition, Still} from "remotion";
import {DentBridgeDemo, DentBridgeThumbnail} from "./DentBridgeDemo";
import {VIDEO_DURATION_SECONDS, VIDEO_FPS} from "./timeline";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DentBridgeDemo"
        component={DentBridgeDemo}
        durationInFrames={VIDEO_DURATION_SECONDS * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={1920}
        height={1080}
      />
      <Still
        id="DentBridgeThumbnail"
        component={DentBridgeThumbnail}
        width={1920}
        height={1080}
      />
    </>
  );
};
