import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { io, Socket } from 'socket.io-client';

import { DndCharacterComponent } from '../dnd-character/dnd-character.component';
import { PartySidebarComponent } from '../party-sidebar/party-sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

interface Token {
  id: string;
  x: number;
  y: number;
  color: string;
  image?: string;
}

@Component({
  selector: 'app-dnd-board',
  standalone: true,
  imports: [CommonModule, DndCharacterComponent, PartySidebarComponent, ToolbarComponent],
  templateUrl: './dnd-board.component.html',
  styleUrls: ['./dnd-board.component.css'],
})
export class DndBoardComponent implements OnInit {
  tokens: Token[] = [];
  private socket!: Socket;
  roomId = 'default-room';
  snapToGrid = true;

  role: 'player' | 'dm' = 'player';
  playerName: string = '';
  character: any = null;
  allCharacters: any[] = [];
  sheetHidden = false;
  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.role = params['role'] || 'player';
      this.playerName = params['name'] || '';
      this.roomId = params['roomId'] || 'default-room';
      this.initSocket();
    });
  }

  private initSocket() {
    this.socket = io('http://localhost:3000/dnd');
    this.socket.emit('joinRoom', this.roomId);

    this.socket.on('initState', (state: { tokens: Token[] }) => {
      this.tokens = state.tokens;
    });

    this.socket.on('tokenMoved', (token: Token) => {
      const idx = this.tokens.findIndex((t) => t.id === token.id);
      if (idx !== -1) this.tokens[idx] = token;
    });

    this.socket.on('tokenAdded', (token: Token) => {
      this.tokens.push(token);
    });

    if (this.role === 'player') {
      this.socket.emit('getCharacter', this.playerName);
      this.socket.on('characterData', (data) => {
        if (data.name === this.playerName) this.character = data.data;
      });
    }

    if (this.role === 'dm') {
      this.socket.emit('getCharacterList');
      this.socket.on('characterList', (list) => (this.allCharacters = list));
    }

    this.socket.on('characterUpdated', ({ name, data }) => {
      if (this.role === 'player' && name === this.playerName) {
        this.character = data;
      }
      if (this.role === 'dm') {
        const idx = this.allCharacters.findIndex((c) => c.name === name);
        if (idx !== -1) this.allCharacters[idx].data = data;
        else this.allCharacters.push({ name, data });
      }
    });
  }

  get party() {
    if (this.role === 'player' && this.character) {
      return [{ ...this.character, name: this.playerName }];
    }
    if (this.role === 'dm') {
      return this.allCharacters.map((c) => ({ ...c.data, name: c.name }));
    }
    return [];
  }

  onDragStart(event: DragEvent, token: Token) {
    event.dataTransfer?.setData('id', token.id);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const id = event.dataTransfer?.getData('id');
    if (!id) return;

    const token = this.tokens.find((t) => t.id === id);
    if (!token) return;

    const board = (event.target as HTMLElement).getBoundingClientRect();
    let newX = event.clientX - board.left - 15;
    let newY = event.clientY - board.top - 15;

    if (this.snapToGrid) {
      const gridSize = 40;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    token.x = newX;
    token.y = newY;

    this.socket.emit('moveToken', this.roomId, token);
  }

  allowDrop(event: DragEvent) {
    event.preventDefault();
  }

  toggleSnap() {
    this.snapToGrid = !this.snapToGrid;
  }

  saveCharacter(updatedChar: any) {
    this.socket.emit('saveCharacter', { name: updatedChar.name, data: updatedChar });
  }
  
  toggleSheet() {
  this.sheetHidden = !this.sheetHidden;
  }
}
