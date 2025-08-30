# TRL ⇄ PGN Viewer - Struttura Web Riorganizzata

La parte web del progetto è stata riorganizzata per migliorare la manutenibilità suddividendo il file monolitico originale in moduli più piccoli e gestibili.

## Struttura dei File

```
web/
├── index-original.html     # Copia di backup dell'originale
├── index.html              # Entrypoint modulare
├── build.sh               # Script di build
├── src/
│   ├── styles/            # CSS modulari
│   │   ├── main.css       # Import principale
│   │   ├── variables.css  # Variabili CSS
│   │   ├── base.css       # Stili base
│   │   ├── header.css     # Header e footer
│   │   ├── layout.css     # Grid e layout
│   │   ├── panels.css     # Pannelli e contenitori
│   │   ├── forms.css      # Form e controlli base
│   │   ├── controls.css   # Controlli player
│   │   ├── board.css      # Scacchiera
│   │   ├── moves.css      # Lista mosse e gioco
│   │   ├── ui-elements.css # Tag, badge, pill
│   │   └── meta.css       # Barra meta giocatori
│   └── js/
│       ├── main.js        # Entry point principale
│       └── modules/
│           ├── utils.js            # Utility generali
│           ├── compression.js      # Compressione/share
│           ├── game-state.js       # Stato del gioco
│           ├── header-manager.js   # Gestione header PGN
│           ├── board-renderer.js   # Rendering scacchiera
│           ├── file-manager.js     # Gestione file
│           └── engine-manager.js   # Integrazione Stockfish
├── dist/                  # File JS transpilati (esistenti)
└── shims/                 # Shim Node.js (esistenti)
```

## Come Usare

### Per Sviluppo (Consigliato)
Usa `index.html` che carica i moduli separati:
```bash
# Avvia un server locale nella directory web
python3 -m http.server 8000
# Apri http://localhost:8000/index.html
```

### Per Produzione
Usa lo script di build per creare una versione ottimizzata:
```bash
./build.sh
# Usa dist/index.html
```

## Vantaggi della Riorganizzazione

### CSS Modulari
- **Manutenibilità**: Ogni file CSS ha una responsabilità specifica
- **Riusabilità**: I moduli possono essere importati/esclusi singolarmente
- **Debug**: Più facile trovare e modificare stili specifici

### JavaScript Modulari
- **Separazione delle responsabilità**: Ogni modulo gestisce una funzionalità
- **Testing**: Ogni modulo può essere testato indipendentemente
- **Estensibilità**: Nuove funzionalità possono essere aggiunte come nuovi moduli

### Struttura dei Moduli JS

1. **utils.js**: Funzioni utility generali, selettori DOM
2. **compression.js**: Gestione compressione per link condivisi
3. **game-state.js**: Classe per gestire lo stato del gioco Chess.js
4. **header-manager.js**: Gestione e editing degli header PGN
5. **board-renderer.js**: Rendering della scacchiera, overlay, animazioni
6. **file-manager.js**: Import/export file, conversioni PGN⇄TRL
7. **engine-manager.js**: Integrazione con Stockfish per analisi

## Compatibilità

✅ **Funzionalità identiche**: Tutte le funzionalità del file originale sono preservate
✅ **Stesso comportamento**: L'interfaccia e l'esperienza utente rimangono identiche
✅ **Performance**: Nessun impatto negativo sulle prestazioni
✅ **Browser support**: Stessa compatibilità browser del file originale

## Migrazione

Per compatibilità, l'originale è stato consolidato. L'entrypoint modulare è `index.html`.

La struttura modularizzata facilita:
- Aggiunta di nuove funzionalità
- Fix di bug specifici
- Personalizzazioni e temi
- Integrazione con build tool moderni (Vite, Webpack, etc.)

## Note per gli Sviluppatori

- I moduli usano ES6 imports/exports
- Il CSS usa l'approccio con variabili CSS custom
- L'architettura è pronta per l'aggiunta di TypeScript
- Struttura compatibile con bundler moderni