const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const httpPort = 8080;
const wsPort = 8081;
const historyFilePath = path.join(__dirname, 'messageHistory.json');

function loadMessageHistory() {
    if (fs.existsSync(historyFilePath)) {
        const data = fs.readFileSync(historyFilePath, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}

function saveMessageHistory(history) {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf-8');
}

let messageHistory = loadMessageHistory();

const server = http.createServer((req, res) => {
    let path = '';
    if (req.url === '/') {
        path = '/client/index.html';
    } else if (req.url === '/client/script.js') {
        path = '/client/script.js';
    } else {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    fs.readFile(__dirname + path, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
        } else {
            res.writeHead(200);
            res.end(data);
        }
    });
});

server.listen(httpPort, () => {
    console.log(`Servidor HTTP rodando na porta ${httpPort}`);
});

const wss = new WebSocket.Server({ port: wsPort });
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Novo cliente conectado');
    clients.set(ws, { username: null });

    ws.send(JSON.stringify({ type: 'history', messages: messageHistory }));

    ws.on('message', (data) => {
        const message = JSON.parse(data);

        if (message.type === 'setUsername') {
            clients.set(ws, { username: message.username });
            broadcastUserList();
            broadcastMessage(`${message.username} entrou no chat`);
        } else if (message.type === 'message') {
            const formattedMessage = `${message.content}`;
            broadcastMessage(formattedMessage);
            messageHistory.push(formattedMessage);
            saveMessageHistory(messageHistory);
        } else if (message.type === 'private') {
            sendPrivateMessage(message.target, message.content, ws);
        } else if (message.type === 'typing') {
            broadcastTypingStatus(message.username);
        }
    });

    ws.on('close', () => {
        const { username } = clients.get(ws);
        clients.delete(ws);
        broadcastUserList();
        broadcastMessage(`${username} saiu do chat`);
    });
});

function broadcastMessage(content, exclude) {
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'message', content }));
        }
    });
}

function broadcastUserList() {
    const users = Array.from(clients.values()).map(user => user.username).filter(Boolean);
    const userListMessage = JSON.stringify({ type: 'userlist', users });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(userListMessage);
        }
    });
}

function broadcastTypingStatus(username) {
    const typingMessage = JSON.stringify({ type: 'typing', content: `${username} está digitando...` });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(typingMessage);
        }
    });
}

function sendPrivateMessage(targetUsername, content, senderWs) {
    const recipient = Array.from(clients.entries()).find(
        ([ws, user]) => user.username === targetUsername
    );

    if (recipient) {
        const [recipientWs] = recipient;
        if (recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({ type: 'private', content }));
        }
    } else {
        senderWs.send(JSON.stringify({
            type: 'message',
            content: `Usuário ${targetUsername} não encontrado.`
        }));
    }
}

console.log(`Servidor WebSocket iniciado na porta ${wsPort}!`);
