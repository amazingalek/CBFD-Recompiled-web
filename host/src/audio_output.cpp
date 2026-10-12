// SDL2 sound output for the RT64 build.
//
// The game's audio thread hands over each buffer the audio microcode mixed
// (osAiSetNextBuffer) and paces itself by how much is still queued
// (osAiGetLength), so the SDL device is used in queue mode: the reported
// remaining frames are what SDL hasn't played yet.
//
// On a page, sound plays through N64Recomp-browser's AudioWorklet output
// (audio_output.h) instead: Emscripten's SDL2 plays its queue from the page's
// thread, where WebGPU's work runs, and its sound broke up whenever that thread
// was busy. That output runs at the page's rate, not the game's, so an SDL audio
// stream resamples to it.

#include <cstdio>
#include <mutex>
#include <vector>

#include <SDL.h>

#include "recompui/config.h"

#include "conker.hpp"

#ifdef __EMSCRIPTEN__
#   include "audio_output.h"
#endif

namespace {
    constexpr int channels = 2;

    std::mutex audio_mutex;
    std::vector<float> convert_buffer;

#ifdef __EMSCRIPTEN__
    SDL_AudioStream* stream = nullptr;
    uint32_t game_rate = 0;
    uint32_t output_rate = 0;
    std::vector<float> stream_buffer;

    void open_device(uint32_t frequency) {
        if (output_rate == 0) {
            output_rate = n64recomp_browser::audio::open(channels);
        }
        if (stream != nullptr) {
            SDL_FreeAudioStream(stream);
        }
        game_rate = frequency;
        stream = SDL_NewAudioStream(AUDIO_F32SYS, channels, (int)frequency, AUDIO_F32SYS, channels, (int)output_rate);
        if (stream == nullptr) {
            std::fprintf(stderr, "[audio] SDL_NewAudioStream failed: %s\n", SDL_GetError());
        }
    }

    bool is_open() {
        return stream != nullptr;
    }

    void queue(const float* frames, size_t sample_count) {
        SDL_AudioStreamPut(stream, frames, (int)(sample_count * sizeof(float)));
        int available = SDL_AudioStreamAvailable(stream);
        stream_buffer.resize(available / sizeof(float));
        int got = SDL_AudioStreamGet(stream, stream_buffer.data(), available);
        if (got > 0) {
            n64recomp_browser::audio::queue(stream_buffer.data(), got / (channels * sizeof(float)));
        }
    }

    // In the game's frames.
    uint32_t queued_frames() {
        return (uint32_t)((uint64_t)n64recomp_browser::audio::queued_frames() * game_rate / output_rate);
    }
#else
    SDL_AudioDeviceID device = 0;

    void open_device(uint32_t frequency) {
        if (!SDL_WasInit(SDL_INIT_AUDIO) && SDL_InitSubSystem(SDL_INIT_AUDIO) != 0) {
            std::fprintf(stderr, "[audio] SDL audio init failed: %s\n", SDL_GetError());
            return;
        }
        if (device != 0) {
            SDL_CloseAudioDevice(device);
            device = 0;
        }
        SDL_AudioSpec want{};
        want.freq = (int)frequency;
        want.format = AUDIO_F32SYS;
        want.channels = channels;
        want.samples = 256; // ~12 ms at 22 kHz: SDL pulls from the queue in chunks this size
        // No allowed changes: SDL converts to whatever the output device uses, so the
        // queue stays in the game's sample rate.
        device = SDL_OpenAudioDevice(nullptr, 0, &want, nullptr, 0);
        if (device == 0) {
            std::fprintf(stderr, "[audio] SDL_OpenAudioDevice failed: %s\n", SDL_GetError());
            return;
        }
        SDL_PauseAudioDevice(device, 0);
    }

    bool is_open() {
        return device != 0;
    }

    void queue(const float* frames, size_t sample_count) {
        SDL_QueueAudio(device, frames, (Uint32)(sample_count * sizeof(float)));
    }

    uint32_t queued_frames() {
        return SDL_GetQueuedAudioSize(device) / (channels * sizeof(float));
    }
#endif
}

void conker::audio::set_frequency(uint32_t frequency) {
    std::lock_guard lock{audio_mutex};
    open_device(frequency);
}

void conker::audio::queue_samples(int16_t* samples, size_t sample_count) {
    std::lock_guard lock{audio_mutex};
    if (!is_open()) {
        return;
    }
    // RDRAM is kept as native-endian 32-bit words, so each stereo frame's two 16-bit
    // samples read back swapped: [i + 1] is the left channel and [i] the right.
    // Scaled by the main volume from the Sound settings (0-100).
    const float scale = static_cast<float>(recompui::config::sound::get_main_volume()) / (100.0f * 32768.0f);
    convert_buffer.resize(sample_count);
    for (size_t i = 0; i + 1 < sample_count; i += channels) {
        convert_buffer[i + 0] = samples[i + 1] * scale;
        convert_buffer[i + 1] = samples[i + 0] * scale;
    }
    queue(convert_buffer.data(), sample_count);
}

size_t conker::audio::get_frames_remaining() {
    std::lock_guard lock{audio_mutex};
    if (!is_open()) {
        return 0;
    }
    // On hardware AI_LEN only counts what is left of the buffer playing now, not the
    // one queued behind it. Conker's audio thread (func_100095A0) makes its next
    // buffer short (552 frames instead of 736) whenever 249 or more samples are
    // left, so reporting the whole SDL queue makes it underrun and pop. Leave one
    // buffer out, so the queue settles at about a buffer and a half.
    constexpr uint32_t one_buffer = 736;
    uint32_t queued = queued_frames();
    return queued > one_buffer ? queued - one_buffer : 0;
}
