# Architecture Plan

## Overview
A static web application for video editing running entirely in the browser using Next.js (Static Export), WebCodecs for preview, and ffmpeg.wasm for export.

## Components
1. **UI Layer (Next.js/React)**
   - Video upload and preview canvas.
   - Controls for Mirror, Speed, Crop/Zoom, and Color Grading.
   - Export progress and guardrails (copyright checkbox).

2. **Preview Engine (WebCodecs + Canvas)**
   - Decodes video frames using `VideoDecoder`.
   - Applies fast visual transformations (CSS filters/Canvas transforms) for real-time preview.
   - Note: WebCodecs is used for fast playback and seeking, while actual export relies on ffmpeg.

3. **Export Engine (ffmpeg.wasm)**
   - Receives the original video file and the set of parameters.
   - Constructs a complex filtergraph (`-vf` and `-af`).
   - Encodes to mp4 (h264/aac).

## Filter Chain (ffmpeg)
- **Mirror**: `hflip`, `vflip`
- **Speed**: `setpts=PTS/SPEED`, `atempo=SPEED`
- **Crop/Zoom**: `crop=iw*(1-CROP):ih*(1-CROP)`, `scale=iw*ZOOM:ih*ZOOM`
- **Color**: `eq=brightness=B:contrast=C:saturation=S:gamma=G`

## Deployment
- Next.js `output: 'export'` generates static HTML/JS/CSS in `/out`.
- Deployed to GitHub Pages via GitHub Actions.
