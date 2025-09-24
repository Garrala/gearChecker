import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-dnd-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dnd-login.component.html',
  styleUrls: ['./dnd-login.component.css']
})
export class DndLoginComponent {
  name = '';
  password = '';
  roomId = 'default-room'; // could allow dynamic rooms later
  errorMessage = '';

  private socket!: Socket;

  constructor(private router: Router) {}

  ngOnInit() {
    this.socket = io('http://localhost:3000/dnd');
  }

  login() {
    this.socket.emit('login', {
      name: this.name,
      password: this.password,
      roomId: this.roomId
    });

    this.socket.on('loginSuccess', (data) => {
      if (data.role === 'dm') {
        this.router.navigate(['/dnd/board'], { queryParams: { role: 'dm', roomId: data.roomId } });
      } else {
        this.router.navigate(['/dnd/board'], { queryParams: { role: 'player', name: data.name, roomId: data.roomId } });
      }
    });

    this.socket.on('loginError', (err) => {
      this.errorMessage = err.message;
    });
  }
}
