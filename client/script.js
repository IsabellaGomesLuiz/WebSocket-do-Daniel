const socket = new WebSocket('ws://localhost:8081');
const usernameInput = document.getElementById('username');
const enterButton = document.getElementById('enter-button');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messages = document.getElementById('messages');
const userList = document.getElementById('user-list');
let username;

//entrar no chat
enterButton.addEventListener('click', () => {
    username = usernameInput.value;
    if (username) {
        socket.send(JSON.stringify({ type: 'setUsername', username }));
        usernameInput.style.display = 'none';
        enterButton.style.display = 'none';
        messageInput.style.display = 'inline-block';
        sendButton.style.display = 'inline-block';
    } else {
        alert('Por favor, digite um username.');
    }
});

socket.onopen = () => {
    console.log("Conexão WebSocket aberta");
};

socket.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
};

socket.onclose = () => {
    console.log("Conexão WebSocket fechada");
};


sendButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message) {
        if (message.startsWith('/private')) {
            const [command, targetUser, ...privateMessage] = message.split(' ');
            if (targetUser && privateMessage.length > 0) {
                socket.send(JSON.stringify({
                    type: 'private',
                    target: targetUser,
                    content: `${username} (privado): ${privateMessage.join(' ')}`
                }));
            } else {
                alert('Formato incorreto. Use: /private nomeDoUsuario mensagem');
            }
        } else {
            socket.send(JSON.stringify({ type: 'message', content: `${username}: ${message}` }));
        }
        messageInput.value = '';
    }
});

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'history') {
        //histórico de mensagens
        message.messages.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            messages.appendChild(li);
        });
    } else if (message.type === 'userlist') {
        userList.innerHTML = '';
        message.users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            userList.appendChild(li);
        });
    } else if (message.type === 'message' || message.type === 'private') {
        const li = document.createElement('li');
        li.textContent = message.content;
        messages.appendChild(li);
    }
};


