class VadCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel?.length) {
      const samples = new Float32Array(channel.length);
      samples.set(channel);
      this.port.postMessage({ samples }, [samples.buffer]);
    }
    return true;
  }
}

registerProcessor("vad-capture-processor", VadCaptureProcessor);
