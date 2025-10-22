# 🎵 Next.js Rhythm Game

A modern rhythm game built with Next.js, React, and Web Audio API featuring automatic beat detection and multiple song support.

## ✨ Features

- 🎮 **Interactive Gameplay** - Hit notes in time with the music
- 🎵 **Multiple Songs** - Choose from 3 different tracks
- 🎯 **Auto Beat Detection** - Automatically detects BPM using web-audio-beat-detector
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Visual Effects** - Confetti, particles, and smooth animations
- 🎚️ **Difficulty Levels** - Easy, Medium, and Hard modes
- 🎪 **Audio Effects** - Dynamic audio processing for hits and misses

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nextjs-rhythm-game.git
cd nextjs-rhythm-game
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 How to Play

1. **Select Difficulty**: Choose between Easy, Medium, or Hard
2. **Select Song**: Pick from Ratatata, Novocaine, or Smells Like Teen Spirit
3. **Hit the Notes**: Press the corresponding keys (D, F, J, K) when notes reach the hit zone
4. **Hold Long Notes**: Keep the key pressed for long notes
5. **Build Combo**: Chain hits together for higher scores

### Controls
- **D** - Left lane (Red)
- **F** - Second lane (Blue) 
- **J** - Third lane (Green)
- **K** - Right lane (Brown)

## 🛠️ Built With

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Web Audio API** - Audio processing and effects
- **web-audio-beat-detector** - Automatic BPM detection
- **canvas-confetti** - Visual effects
- **CSS Modules** - Styled components

## 📁 Project Structure

```
src/
├── components/
│   ├── SimpleRhythmGame.tsx    # Main game component
│   └── RhythmGame.module.css   # Game styles
public/
└── music/                      # Audio files
    ├── ratatata.mp3
    ├── Novocaine.mp3
    └── SLTS.mp3
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Deploy with zero configuration

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- Heroku
- AWS Amplify

## 🎵 Adding New Songs

1. Add your audio file to `public/music/`
2. Update the `getSongPath()` function in `SimpleRhythmGame.tsx`
3. Add a new option to the song selection UI

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Music tracks used for demonstration purposes
- Web Audio API community
- Next.js team for the amazing framework