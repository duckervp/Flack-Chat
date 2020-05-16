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
    console.log("postUser");

    socket.emit("postUser", { username });

    // Get all room
    console.log("requestAllRoom");

    socket.emit("requestAllRoom");

    if (localStorage.getItem("room")) {
      console.log("verifyRoom");

      // Verify room in case the room name at localstorage not exist on the server
      socket.emit("verifyRoom", { room: localStorage.getItem("room") });
    }

    // Modify create room form
    document.querySelector(".create-room-form").onsubmit = (e) => {
      console.log("newRoomCreate");

      e.preventDefault();
      username = localStorage.getItem("username");
      const room = e.target.elements.room_name.value;
      socket.emit("newRoom", { username, room });
      e.target.elements.room_name.value = "";
      e.target.elements.room_name.focus();
    };

    // Modify send message form
    document.querySelector(".message-input-form").onsubmit = (e) => {
      console.log("newMessageCreate");

      e.preventDefault();
      const state = "Public";
      username = localStorage.getItem("username");
      const time = new Date().toLocaleTimeString();
      const message = e.target.elements.message_input.value;
      room = localStorage.getItem("room");
      console.log({ state, username, time, message, room });
      socket.emit("newMessage", { state, username, time, message, room });
      e.target.elements.message_input.value = "";
      e.target.elements.message_input.focus();
    };
  });

  // Validate user and display to DOM
  socket.on("userResponse", (data) => {
    console.log("userResponse");

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
    console.log("allRoomRessponse");

    removeAllRoom();

    data.forEach((room) => {
      addRoom(room);
    });
  });

  // On verify room response
  socket.on("verifiedRoom", (data) => {
    console.log("virifiedRoom");

    if (data.success) {
      const room = data["room"];
      const time = new Date().toLocaleTimeString();
      socket.emit("join", {
        username: localStorage.getItem("username"),
        room: room,
        time: time,
      });
      console.log("getCurrentRoomMSG");

      socket.emit("requestCurrentRoom", { room });

      setTimeout(() => {
        activeRoom(room);
      }, 500);
    } else {
      localStorage.removeItem("room");
    }
  });

  // Get and display current room message to DOM
  socket.on("roomMessageResponse", (data) => {
    console.log("roomMessageResponse");
    removeAllMessage();
    data.forEach((item) => {
      addMessage(item.state, item.user, item.time, item.message);
    });
    const messageList = document.querySelector(".message-container");
    messageList.scrollTop = messageList.scrollHeight;
  });

  // On create room response
  socket.on("newRoomResponse", (data) => {
    console.log("newRoomResponse");
    if (data.success) {
      const username = data.user;
      const room = data.room;
      addRoom(room);
    } else {
      alert("Invalid room name!");
    }
  });

  // On create new message response
  socket.on("newMessageResponse", (data) => {
    console.log("newMessageResponse");
    if (data.success) {
      const msg = data.msg;
      console.log(msg.state, msg.user, msg.time, msg.message);
      addMessage(msg.state, msg.user, msg.time, msg.message);

      const messageList = document.querySelector(".message-container");
      messageList.scrollTop = messageList.scrollHeight;
    } else if (data.error == "room_null") {
      alert("Enter a room to start chat.");
    } else {
      alert("Invalid message!");
    }
  });

  // Function add user to DOM
  function displayUser(username) {
    console.log("displayUser");
    const username_p = document.querySelector(".user-name");
    username_p.innerHTML = username;
  }

  // Function remove all room from DOM
  function removeAllRoom() {
    console.log("removeAllRoom");
    document.querySelector(".room-list").innerHTML = "";
  }

  // Function add room to DOM
  function addRoom(room) {
    console.log("addRoom");
    const roomList = document.querySelector(".room-list");
    const roomItem = document.createElement("p");
    roomItem.innerHTML = room;
    roomItem.classList.add("room-item");
    roomList.appendChild(roomItem);

    roomItem.addEventListener("click", () => {
      const username = localStorage.getItem("username");
      const leftRoom = localStorage.getItem("room");
      const time = new Date().toLocaleTimeString();
      console.log("leaveEvent");

      socket.emit("leave", {
        username: username,
        room: leftRoom,
        time: time,
      });

      localStorage.setItem("room", room);

      socket.emit("join", { username: username, room: room, time: time });
      console.log("joinEvent");

      socket.emit("requestCurrentRoom", { room });
      console.log("requestRoomMSG");

      activeRoom(room);
    });
  }

  // Active room
  function activeRoom(room) {
    console.log("activeRoom");

    document.querySelector(".current-room").innerHTML = room;

    document.querySelectorAll(".room-item").forEach((item) => {
      if (item.innerHTML == room) {
        item.classList.add("bg-info");
      } else {
        item.classList.remove("bg-info");
      }
    });
  }

  // Function remove all Message from DOM
  function removeAllMessage() {
    console.log("removeAllMessage");
    document.querySelector(".message-container").innerHTML = "";
  }

  // Function add message to DOM
  function addMessage(state, user, time, message) {
    console.log("addMessage");
    const messageList = document.querySelector(".message-container");

    const messageItem = document.createElement("div");
    messageItem.innerHTML = `
    <span class="username">${user}</span>
      <span class="state">${state}</span>
      <span class="time">${time}</span>
      <p class="message">${message}</p>
    `;
    messageItem.classList.add("message-item");
    messageList.appendChild(messageItem);
  }
});
