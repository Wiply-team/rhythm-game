# Music Files

This directory should contain the following audio files for the rhythm game:

- `ratatata.mp3` - Ratatata track
- `Novocaine.mp3` - Novocaine track  
- `SLTS.mp3` - Smells Like Teen Spirit track

## Note for Deployment

These audio files are excluded from Git due to their large size. For deployment:

1. **Vercel**: Upload the audio files directly to the `public/music/` directory in your deployment
2. **Other platforms**: Ensure the audio files are included in your deployment package

## File Requirements

- Format: MP3
- Recommended bitrate: 128-320 kbps
- Duration: 2-5 minutes recommended
- Size: Keep under 10MB per file for optimal loading