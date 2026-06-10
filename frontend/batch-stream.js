/**
 * SSE batch upload — real-time progress for large CSV files.
 */
(function (global) {
  'use strict';

  function parseSseChunk(buffer, onEvent) {
    var parts = buffer.split('\n\n');
    var rest = parts.pop();
    parts.forEach(function (block) {
      var line = block.split('\n').find(function (l) {
        return l.indexOf('data: ') === 0;
      });
      if (!line) return;
      try {
        onEvent(JSON.parse(line.slice(6)));
      } catch (e) {
        console.warn('SSE parse error', e);
      }
    });
    return rest || '';
  }

  async function uploadCsvClassic(file) {
    var formData = new FormData();
    formData.append('file', file);
    var res = await fetch(window.apiUrl('/api/predict'), {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      var errBody = await res.json().catch(function () {
        return { error: 'HTTP ' + res.status };
      });
      throw new Error(errBody.error || 'HTTP ' + res.status);
    }
    var data = await res.json();
    return data.results || data.predictions || [];
  }

  async function uploadCsvStream(file, callbacks) {
    callbacks = callbacks || {};
    var formData = new FormData();
    formData.append('file', file);

    var res = await fetch(window.apiUrl('/api/predict/stream'), {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      var errBody = await res.json().catch(function () {
        return { error: 'HTTP ' + res.status };
      });
      throw new Error(errBody.error || 'HTTP ' + res.status);
    }

    if (!res.body || !res.body.getReader) {
      throw new Error('Streaming not supported in this browser');
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var finalResults = null;

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      buffer = parseSseChunk(buffer, function (ev) {
        if (ev.type === 'started' && callbacks.onStart) callbacks.onStart(ev);
        if (ev.type === 'progress' && callbacks.onProgress) callbacks.onProgress(ev);
        if (ev.type === 'complete') {
          finalResults = ev.results;
          if (callbacks.onComplete) callbacks.onComplete(ev);
        }
        if (ev.type === 'error') throw new Error(ev.error || 'Stream error');
      });
    }

    if (!finalResults) throw new Error('Stream ended without results');
    return finalResults;
  }

  global.BatchStream = { uploadCsvStream: uploadCsvStream, uploadCsvClassic: uploadCsvClassic };
})(typeof window !== 'undefined' ? window : this);
