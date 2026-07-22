# Font dei caroselli (self-hosted)

Questi file rendono i caroselli **identici su ogni dispositivo**: il canvas usa
il font incorporato invece del font di sistema, che cambia tra Windows, Mac,
Android e iOS.

## Scaricare i font (una volta sola)

Dalla cartella del progetto, sulla tua macchina:

```bash
npm run fonts
```

Lo script scarica gli 8 file elencati sotto in `public/fonts/`.
I `.ttf` non sono versionati su git (vedi `.gitignore`): vanno scaricati una
volta per macchina/VM. Se la cartella è vuota l'app **non si rompe**: i
caroselli ricadono automaticamente sui font di sistema (come prima).

## File attesi

| File                  | Famiglia         | Peso |
| --------------------- | ---------------- | ---- |
| `montserrat-400.ttf`  | Montserrat       | 400  |
| `montserrat-700.ttf`  | Montserrat       | 700  |
| `montserrat-900.ttf`  | Montserrat       | 900  |
| `inter-400.ttf`       | Inter            | 400  |
| `inter-700.ttf`       | Inter            | 700  |
| `bebasneue-400.ttf`   | Bebas Neue       | 400  |
| `playfair-700.ttf`    | Playfair Display | 700  |
| `robotomono-400.ttf`  | Roboto Mono      | 400  |

Tutti i font sono sotto **SIL Open Font License 1.1**, che ne consente l'uso
commerciale e la ridistribuzione self-hosted.
