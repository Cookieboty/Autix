/**
 * 音频裁剪工具。
 *
 * 不引第三方库：波形渲染只需要 decodeAudioData 出来的 PCM 峰值，裁剪用
 * OfflineAudioContext 重渲染选段，编码走手写 WAV 头 —— wavesurfer 之类的库
 * 只覆盖"画波形"，裁剪和编码仍要自己做，引入它省不下核心工作量。
 *
 * 输出固定为 WAV：浏览器原生只能编码 PCM/WAV，要输出 mp3 得额外引 lamejs。
 * 15 秒 44.1kHz 立体声约 2.6MB，对上传可接受。
 */

/** 复用同一个 AudioContext：每次 new 一个在 Safari 上会很快耗尽实例配额 */
let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  return sharedContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  // decodeAudioData 会 detach 传入的 ArrayBuffer，传副本以免调用方后续再用时拿到空 buffer
  return getAudioContext().decodeAudioData(arrayBuffer.slice(0));
}

/**
 * 把 PCM 压成 `bars` 个峰值（0~1），用于画等宽竖条波形。
 * 取每段的最大绝对值而非平均值 —— 平均会把波形抹平成一条，看不出节奏。
 */
export function buildPeaks(buffer: AudioBuffer, bars: number): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i += 1) {
    const start = i * blockSize;
    let peak = 0;
    for (let j = 0; j < blockSize; j += 1) {
      const value = Math.abs(channel[start + j] ?? 0);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }
  // 归一化：整体偏轻的音频不至于画出一条几乎看不见的线
  const max = Math.max(...peaks, 0.01);
  return peaks.map((p) => p / max);
}

/** AudioBuffer → WAV(16bit PCM) Blob */
function encodeWav(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk 长度
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);

  // 声道交错写入，并把 float(-1~1) 量化成 int16
  const channels = Array.from({ length: channelCount }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < sampleCount; i += 1) {
    for (let c = 0; c < channelCount; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/**
 * 截取 [startSec, startSec + durationSec) 并编码成 WAV File。
 * 用 OfflineAudioContext 而非直接切数组：它会正确处理采样率与多声道，
 * 也留下了后续加淡入淡出的口子。
 */
export async function trimAudioToWav(
  buffer: AudioBuffer,
  startSec: number,
  durationSec: number,
  fileName: string,
): Promise<File> {
  const sampleRate = buffer.sampleRate;
  const length = Math.min(
    Math.floor(durationSec * sampleRate),
    Math.max(0, buffer.length - Math.floor(startSec * sampleRate)),
  );
  const offline = new OfflineAudioContext(buffer.numberOfChannels, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0, startSec, length / sampleRate);
  const rendered = await offline.startRendering();

  const base = fileName.replace(/\.[^.]+$/, '');
  return new File([encodeWav(rendered)], `${base}-trimmed.wav`, { type: 'audio/wav' });
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
