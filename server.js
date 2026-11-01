const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Настройка порта под требования платформы Render
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 5;

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    
    // Обработка кнопки "Сохранить" (создание новой комнаты)
    socket.on('create_room', ({ roomName, roomPass, nickname, skin }) => {
        if (!roomPass) return socket.emit('error_message', 'Введите пароль комнаты!');
        if (rooms[roomPass]) return socket.emit('error_message', 'Такой пароль уже занят!');

        rooms[roomPass] = {
            roomName: roomName || `Комната ${roomPass}`,
            hostId: socket.id,
            players: [{ id: socket.id, nickname, skin }]
        };

        socket.join(roomPass);
        
        // Отправляем первый статус 1/5 обратно создателю
        socket.emit('room_created', { 
            roomName: rooms[roomPass].roomName,
            roomPass: roomPass,
            countText: `1/${MAX_PLAYERS}`
        });

        io.to(roomPass).emit('update_players_list', rooms[roomPass].players);
    });// Обработка подключения другого игрока по паролю
    socket.on('join_room', ({ roomPass, nickname, skin }) => {
        const room = rooms[roomPass];
        if (!room) return socket.emit('error_message', 'Комната с таким паролем не найдена!');
        if (room.players.length >= MAX_PLAYERS) return socket.emit('error_message', 'Комната переполнена (максимум 5)!');

        room.players.push({ id: socket.id, nickname, skin });
        socket.join(roomPass);

        socket.emit('room_joined', {
            roomName: room.roomName,
            roomPass: roomPass,
            countText: `${room.players.length}/${MAX_PLAYERS}`
        });

        // Всем участникам комнаты обновляем живой счётчик игроков
        io.to(roomPass).emit('update_room_counter', `${room.players.length}/${MAX_PLAYERS}`);
        io.to(roomPass).emit('update_players_list', room.players);
    });

    // Обработка выхода игрока с сайта (закрытие вкладки)
    socket.on('disconnect', () => {
        for (const roomPass in rooms) {
            const room = rooms[roomPass];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomPass]; // Удаляем комнату, если она опустела
                } else {
                    io.to(roomPass).emit('update_room_counter', `${room.players.length}/${MAX_PLAYERS}`);
                    io.to(roomPass).emit('update_players_list', room.players);
                }
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер игры успешно запущен на порту ${PORT}`);
});
