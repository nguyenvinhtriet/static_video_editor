# Test Matrix

## Environments
- Chrome (Desktop)
- Firefox (Desktop)
- Safari (Desktop/macOS)

## File Sizes
- Small (< 5MB, 720p)
- Medium (10-30MB, 1080p)
- Large (50MB+, 1080p/4K) - *May hit OOM in ffmpeg.wasm, test 10s export limit.*

## Operations
1. **Mirror**: Horizontal and Vertical flip.
2. **Speed**: 0.85x and 1.15x.
3. **Crop/Zoom**: 10% crop, 1.1x zoom.
4. **Color**: Adjust brightness, contrast, saturation.

## Test Cases
| ID | Browser | File Size | Operations | Expected Result |
|---|---|---|---|---|
| TC01 | Chrome | Small | Mirror H | Success, fast export |
| TC02 | Chrome | Medium | Speed 1.15x | Success, audio/video sync |
| TC03 | Firefox | Small | Color | Success, visual match |
| TC04 | Safari | Medium | Crop/Zoom | Success |
| TC05 | Chrome | Large | All (10s limit) | Success, OOM avoided |
