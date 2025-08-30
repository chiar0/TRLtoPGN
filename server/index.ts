#!/usr/bin/env node
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';

import { pgnToTrl } from '../pgn-to-trl.js';
import { ludiiToPgn } from '../trl-to-pgn.js';

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Static UI (simple upload form)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

type ConvertBody = {
  inputType: 'pgn' | 'trl';
  data: string;
  options?: { fileName?: string; eventName?: string; white?: string; black?: string };
};

app.post('/api/convert', (req: Request, res: Response) => {
  const body = req.body as ConvertBody;
  if (!body || !body.inputType || !body.data) return res.status(400).json({ error: 'Missing inputType or data' });
  try {
    if (body.inputType === 'pgn') {
      const trl = pgnToTrl(body.data);
      return res.json({ outputType: 'trl', output: trl });
    } else if (body.inputType === 'trl') {
      const file = body.options?.fileName ?? 'uploaded.trl';
      const eventName = body.options?.eventName ?? 'Uploaded';
      const white = body.options?.white ?? 'Player 1';
      const black = body.options?.black ?? 'Player 2';
      const pgn = ludiiToPgn(body.data, file, eventName, white, black);
      return res.json({ outputType: 'pgn', output: pgn });
    } else {
      return res.status(400).json({ error: 'inputType must be pgn or trl' });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/convert-upload', upload.single('file'), (req: Request, res: Response) => {
  const inputType = (req.body?.inputType as 'pgn' | 'trl') || null;
  const file = req.file;
  if (!inputType || !file) return res.status(400).json({ error: 'inputType and file are required' });
  const data = file.buffer.toString('utf-8');
  try {
    if (inputType === 'pgn') {
      const trl = pgnToTrl(data);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(trl);
    } else {
      const pgn = ludiiToPgn(data, file.originalname || 'uploaded.trl', 'Uploaded', 'Player 1', 'Player 2');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(pgn);
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Converter server listening on http://localhost:${PORT}`);
});
