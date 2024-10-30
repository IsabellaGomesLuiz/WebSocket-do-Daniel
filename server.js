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

//salvar histórico de mensagens
function saveMessageHistory(history) {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf-8');
}

//Carregar histórico de mensagens
let messageHistory = loadMessageHistory();

const server = http.createServer((req, res) => {
    let filePath = '';

    if (req.url === '/') {
        filePath = path.join(__dirname, 'client', 'index.html');
    } else if (req.url === '/script.js') {
        filePath = path.join(__dirname, 'client', 'script.js');
    } else {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
        } else {
            const contentType = req.url.endsWith('.js') ? 'application/javascript' : 'text/html';
            res.writeHead(200, { 'Content-Type': contentType });
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

    //Mostrar histórico para cliente novo
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

//lista de usuários conectados
function broadcastUserList() {
    const users = Array.from(clients.values()).map(user => user.username).filter(Boolean);
    const userListMessage = JSON.stringify({ type: 'userlist', users });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(userListMessage);
        }
    });
}

//mensagem privada
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
            content: `User ${targetUsername} não encontrado.`
        }));
    }
}

console.log(`Servidor WebSocket iniciado na porta ${wsPort}!`);