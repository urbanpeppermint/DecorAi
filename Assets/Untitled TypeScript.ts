import { clamp } from "SpectaclesInteractionKit.lspkg/Utils/mathUtils";
import { Slider } from "SpectaclesInteractionKit.lspkg/Components/UI/Slider/Slider";

@component
export class SliderControlModule extends BaseScriptComponent {
  @input
  @hint("SIK Slider component for crossfade control")
  public crossfadeSlider: Slider;

  @input
  @hint("SIK Slider component for audio position/seek control")
  public audioPositionSlider: Slider;

  @input
  @hint("Enable audio position slider control")
  public enableAudioSeeking: boolean = true;

  private audioComponent: AudioComponent;
  private isAudioPlaying: boolean = false;

  onAwake() {
    this.audioComponent = this.getSceneObject().createComponent("Component.AudioComponent");
  }

  onStart() {
    this.initializeCrossfadeControl();
    this.initializeAudioPositionControl();
  }

  private initializeCrossfadeControl() {
    if (this.crossfadeSlider) {
      this.crossfadeSlider.onValueUpdate.add((value: number) => {
        print(`🎛️ [CrossfadeSlider] Moved: ${value.toFixed(3)}`);
        this.onCrossfadeValueChanged(value);
      });
      print("✅ Connected to crossfade slider");
    } else {
      print("⚠️ No crossfade slider assigned");
    }
  }

  private initializeAudioPositionControl() {
    if (this.audioPositionSlider && this.enableAudioSeeking) {
      this.audioPositionSlider.onValueUpdate.add((value: number) => {
        print(`🎚️ [AudioPositionSlider] Moved: ${value.toFixed(3)}`);
        this.onAudioPositionValueChanged(value);
      });
      print("✅ Connected to audio position slider");
    } else {
      print("⚠️ No audio position slider assigned or seeking disabled");
    }
  }

  private onAudioPositionValueChanged(value: number) {
    if (!this.audioComponent || !this.audioComponent.audioTrack) {
      print("⚠️ Cannot seek: No audio asset assigned");
      return;
    }

    const duration = this.audioComponent.duration;
    const target = clamp(value * duration, 0, duration);
    this.audioComponent.position = target;

    if (!this.audioComponent.isPlaying()) {
      this.audioComponent.play(-1);
      print("▶️ Audio started from slider input");
    }

    print(`🎯 Audio seek: ${target.toFixed(2)}s / ${duration.toFixed(2)}s`);
  }

  private onCrossfadeValueChanged(value: number) {
    const { a, b } = this.getCrossfadeVolumes(value);
    this.applyCrossfadeVolumes(a, b);
    print(`🎛️ Crossfade volumes → A: ${(a*100).toFixed(1)}%, B: ${(b*100).toFixed(1)}%`);
  }

  private getCrossfadeVolumes(norm: number): { a: number; b: number } {
    return {
      a: 1.0 - norm,
      b: norm,
    };
  }

  private applyCrossfadeVolumes(volumeA: number, volumeB: number) {
    const playing = SliderControlModule.playingTracks;
    if (playing.length >= 2) {
      try {
        playing[playing.length - 2].volume = volumeA;
        playing[playing.length - 1].volume = volumeB;
        print(`🔊 Applied crossfade: TrackA=${volumeA.toFixed(2)}, TrackB=${volumeB.toFixed(2)}`);
      } catch (err) {
        print(`❌ Crossfade error: ${err}`);
      }
    } else if (playing.length === 1) {
      playing[0].volume = 1.0;
      print("🔊 Single track playing at full volume");
    }
  }

  // Static track state for crossfade logic
  private static playingTracks: AudioComponent[] = [];
  private static maxPlayingTracks = 2;

  static addTrack(track: AudioComponent) {
    const index = SliderControlModule.playingTracks.indexOf(track);
    if (index !== -1) SliderControlModule.playingTracks.splice(index, 1);
    SliderControlModule.playingTracks.push(track);

    if (SliderControlModule.playingTracks.length > SliderControlModule.maxPlayingTracks) {
      SliderControlModule.playingTracks.shift();
    }

    print(`🎵 Track added | Total tracks: ${SliderControlModule.playingTracks.length}`);
  }

  static removeTrack(track: AudioComponent) {
    const index = SliderControlModule.playingTracks.indexOf(track);
    if (index !== -1) {
      SliderControlModule.playingTracks.splice(index, 1);
      print(`🛑 Track removed | Remaining: ${SliderControlModule.playingTracks.length}`);
    }
  }
}
