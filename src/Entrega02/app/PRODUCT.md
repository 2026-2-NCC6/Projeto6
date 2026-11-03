# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

(Expo / React Native. The same custom design language also ships on Android; test devices are an iPhone 16 Pro and a Galaxy S25.)

## Users

Tennis and ping-pong practitioners aged 13+ (13–17 with a guardian's consent) training alone with a ball launcher. They are on court, racket in one hand, often sweaty or gloved, sometimes under direct sun, and cannot walk to the machine between drills.

## Product Purpose

NockHug is a ball launcher controlled by the practitioner's voice through the phone. The app prepares the session with a safety checklist, listens for a wake word followed by a command (liga, desliga, pausa, retoma), estimates balls per series, keeps an emergency stop always at hand, and turns every session into visible progress (XP, levels, day streak, achievements). Each training carries its own motor velocity (Forte/Médio/Fraco or custom), the rest between series can be adjusted in place, and at the end of the rest the next series starts on its own after a 5-second beep warning unless the practitioner cancels with the wake word. Stopping stays reachable on every screen while a session is active, and the session only ends after the launcher confirms the motors stopped. Success: a full session run hands-free, stopped safely, and remembered.

## Positioning

Voice-first control of a physical launcher with safety designed in: the machine only fires after the checklist arms it, "Para!" works without the wake word, and the launcher stops on its own after 4 s without the app.

## Operating Context

Used on court during training; Wi-Fi (the launcher's own access point) or Bluetooth; works offline, all data on the device (SQLite). A simulated launcher exists for demos. Demo at Semana FECAP de Tecnologia, 17–24/11/2026.

## Capabilities and Constraints

Onboarding (7 steps), Home with streak and activity heatmap, training presets and custom trainings, a create/edit training sheet, per-training motor velocity (Forte 60/30, Médio 40/25, Fraco 30/20; custom lançador 0–100%, alimentador 15–40%) required on the first session of each built-in training, adjustable rest in the session, rest auto-resume with a 5-second beep warning and voice cancel, voice session, safe stop (hold 2 s to reset), result with XP, history, achievements, settings, calibration of seconds per ball at a chosen velocity, launcher connection with diagnostics and repair. No sensor: ball counts are estimates. No website (out of scope by ADR 0003). Theme follows the system by default, with a manual override. Every motor start (voice, button, resume, end of rest, calibration) waits for a 5-second beep countdown that the wake word plus "desliga"/"para" cancels. Voice keeps listening with the screen locked on both platforms (iOS background audio; Android foreground service with the "NockHug está ouvindo" notification), and a headset microphone is used when connected (Bluetooth via SCO on Android).

## Brand Commitments

- Name: NockHug. Logo: `logo-nockhug.png` (a smiling tennis ball hugging itself, sound waves, "NockHug!" wordmark) — binding.
- Palette pinned by the team: #15370D (primary green), #728E6D (secondary green), #E5CD82 (beige), #FFF2B4 (yellow) and #DFFF4F (optic lime) as the hero accent.
- Copy in Brazilian Portuguese, direct and friendly.

## Evidence on Hand

Logo only. No photograph of the assembled launcher yet; the launcher is drawn in code.

## Product Principles

1. Stopping is always easier than starting.
2. Never require touching the screen mid-drill; buttons exist as a fallback, not the primary path.
3. Honest numbers: estimates are labeled as estimates.
4. Progress is felt after every session.

## Accessibility & Inclusion

Readable under sun (high contrast), 44 pt touch targets, Reduce Motion honored, haptics never the only feedback.
