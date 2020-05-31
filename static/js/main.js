document.addEventListener("DOMContentLoaded", () => {
  // Define socket
  var socket = io.connect(
    location.protocol + "//" + document.domain + ":" + location.port
  );

  // Socket on connect
  socket.on("connect", () => {
    // Get username and room
    let username = localStorage.getItem("username");

    // Verify the user
    socket.emit("postUser", { username });

    // Get all room
    socket.emit("requestAllRoom");

    if (localStorage.getItem("room")) {
      // Verify room in case the room name at localstorage not exist on the server
      socket.emit("verifyRoom", { room: localStorage.getItem("room") });
    }

    // Modify create room form
    document.querySelector(".create-room-form").onsubmit = (e) => {
      e.preventDefault();
      username = localStorage.getItem("username");
      const room = e.target.elements.room_name.value;
      socket.emit("newRoom", { username, room });
      e.target.elements.room_name.value = "";
      e.target.elements.room_name.focus();
    };

    // Upload image
    document.querySelector("#files").addEventListener("change", e =>{
      const file = e.target.files[0];
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        const arrayBuffer = fileReader.result;
        let state = "Public";
        const username = localStorage.getItem("username");
        const room = localStorage.getItem("room");
        const time = new Date().toLocaleTimeString();
        const sendTo = document.getElementById("send_to").value;
        if (sendTo != "All Room") {
          state = "Private";
        }
        const img = {
          name: file.name,
          type: file.type,
          size: file.size,
          binary: arrayBuffer
        }

        // Send an image as message
        socket.emit("newMessage", {
          state,
          username,
          sendTo,
          time,
          message: img.binary,
          room
        });
        document.getElementById("message_input").value = "";
        document.getElementById("message_input").focus();
      }
    });

    // Modify send message form
    document.querySelector(".message-input-form").onsubmit = (e) => {
      e.preventDefault();
      let state = "Public";
      username = localStorage.getItem("username");
      const time = new Date().toLocaleTimeString();
      const sendTo = e.target.elements.send_to.value;
      const message = e.target.elements.message_input.value;
      if (sendTo != "All Room") {
        state = "Private";
      }
      room = localStorage.getItem("room");
      socket.emit("newMessage", {
        state,
        username,
        sendTo,
        time,
        message,
        room
      });
      e.target.elements.message_input.value = "";
      e.target.elements.message_input.focus();
    };
  });

  // On disconnect
  socket.on("disconnect", (data) => {
    const username = data.user;
    const leftRoom = data.room;
    const time = new Date().toLocaleTimeString();
    socket.emit("announceDisconnect", {
      user: username,
      room: leftRoom,
      time: time,
    });
    socket.emit("requestRoomMember", { room: leftRoom });
  });

  // Validate user and display to DOM
  socket.on("userResponse", (data) => {
    if (data.success) {
      localStorage.setItem("username", data.username);
      displayUser(data.username);
    } else {
      const username = prompt("Hello, What's your name:");
      socket.emit("postUser", { username });
    }
  });

  // Get back all public room and add to DOM
  socket.on("allRoomResponse", (data) => {
    removeAllRoom();
    data.forEach((room) => {
      addRoom(room);
    });
  });

  // On verify room response
  socket.on("verifiedRoom", (data) => {
    if (data.success) {
      const room = data["room"];
      const time = new Date().toLocaleTimeString();
      socket.emit("join", {
        username: localStorage.getItem("username"),
        room: room,
        time: time,
      });

      socket.emit("requestCurrentRoom", { room });
      socket.emit("requestRoomMember", { room });

      setTimeout(() => {
        activeRoom(room);
      }, 500);
    } else {
      localStorage.removeItem("room");
    }
  });

  // Get and display current room message to DOM
  socket.on("roomMessageResponse", (data) => {
    removeAllMessage();
    data.forEach((item) => {
      addMessage(item.state, item.user, item.sendTo, item.time, item.message);
    });
    const messageList = document.querySelector(".message-container");
    messageList.scrollTop = messageList.scrollHeight;
  });

  // On create room response
  socket.on("newRoomResponse", (data) => {
    if (data.success) {
      const username = data.user;
      const room = data.room;
      addRoom(room);
    } else {
      alert("Invalid room name!");
    }
  });

  // On room member response
  socket.on("roomMemberResponse", (data) => {
    document.querySelector(".member-container").innerHTML = "";
    data.members.forEach((member) => {
      addMember(member);
    });
  });

  // On room member join response
  socket.on("memberJoin", (data) => {
    addMember(data.member);
  });

  // On room member leave response
  socket.on("memberLeave", (data) => {
    document.querySelectorAll(".member-item").forEach((item) => {
      if (item.innerHTML == data.member) {
        item.remove();
      }
    });
  });

  // On create new message response
  socket.on("newMessageResponse", (data) => {
    if (data.success) {
      const msg = data.msg;
      addMessage(msg.state, msg.user, msg.sendTo, msg.time, msg.message);
      const messageList = document.querySelector(".message-container");
      messageList.scrollTop = messageList.scrollHeight;
    } else if (data.error == "member_not_exist") {
      alert("Member you want to send private message does not exist.");
    } else if (data.error == "room_null") {
      alert("Enter a room to start chat.");
    } else {
      alert("Invalid message!");
    }
  });

  // Function add user to DOM
  function displayUser(username) {
    const username_p = document.querySelector(".user-name");
    username_p.innerHTML = username;
  }

  // Function remove all room from DOM
  function removeAllRoom() {
    document.querySelector(".room-list").innerHTML = "";
  }

  // Function add room to DOM
  function addRoom(room) {
    const roomList = document.querySelector(".room-list");
    const roomItem = document.createElement("p");
    roomItem.innerHTML = room;
    roomItem.classList.add("room-item");
    roomList.appendChild(roomItem);

    roomItem.addEventListener("click", () => {
      const username = localStorage.getItem("username");
      const leftRoom = localStorage.getItem("room");
      const time = new Date().toLocaleTimeString();

      socket.emit("leave", {
        username: username,
        room: leftRoom,
        time: time,
      });

      localStorage.setItem("room", room);

      socket.emit("join", { username: username, room: room, time: time });
      socket.emit("requestCurrentRoom", { room });
      socket.emit("requestRoomMember", { room });

      activeRoom(room);
    });
  }

  // Active room
  function activeRoom(room) {
    document.querySelector(".current-room").innerHTML = room;
    document.querySelectorAll(".room-item").forEach((item) => {
      if (item.innerHTML == room) {
        item.classList.add("bg-primary");
      } else {
        item.classList.remove("bg-primary");
      }
    });
  }

  // Function remove all Message from DOM
  function removeAllMessage() {
    document.querySelector(".message-container").innerHTML = "";
  }

  // Function add message to DOM
  function addMessage(state, user, sendTo, time, message) {
    const messageList = document.querySelector(".message-container");
    const messageItem = document.createElement("div");
    messageItem.classList.add("message-item");
    let color = "primary";
    let receiver = sendTo;
    if (!sendTo || sendTo == "All Room") {
      receiver = "";
    } else if (sendTo == localStorage.getItem("username")) {
      receiver = "to Me";
    } else {
      receiver = `to ${sendTo}`;
    }
    if (state == "Public") {
      if (user == "FlackServer") {
        // color = "secondary";
        color = "";
        messageItem.classList.add("message-item-center");
      } else if (user == localStorage.getItem("username")) {
        messageItem.classList.add("message-item-right");
      } else {
        messageItem.classList.add("message-item-left");
      }
    } else {
      color = "success";
      if (user == localStorage.getItem("username")) {
        messageItem.classList.add("message-item-right");
      } else {
        messageItem.classList.add("message-item-left");
      }
    }
    if (message.search("data:image/jpeg;base64,") == -1) {
      messageItem.innerHTML = `
        <span class="username">${user}</span>
        <span class="sendTo bg-danger">${receiver}</span>
        <span class="time">${time}</span>
        <p class="message bg-${color}">${message}</p>
      `;
    } else {
      messageItem.innerHTML = `
        <span class="username">${user}</span>
        <span class="sendTo bg-danger">${receiver}</span>
        <span class="time">${time}</span>
        <img src="${message}" class="message bg-${color} image">
      `;
    }
    messageList.appendChild(messageItem);
  }

  // Function add room member to DOM
  function addMember(member) {
    const memberItem_p = document.createElement("p");
    memberItem_p.innerHTML = member;
    memberItem_p.classList.add("member-item");

    document.querySelector(".member-container").appendChild(memberItem_p);
  }
});
