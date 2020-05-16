from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

# Init app
app = Flask(__name__)
app.config['SECRET_KEY'] = b'dascvbzxvba!@*&^lguw;kb'
socketio = SocketIO(app)
app.debug = True

# Global variable
USERS = {}
ROOMS = {}
MSGLIMIT = 100

# Main
@app.route("/")
def index():
  return render_template("index.html")

@socketio.on("connect")
def onConnect():
  print(f"{request.sid} has connected")

@socketio.on("disconnect")
def onDisconnect():
  d_user = ""
  for user, sid in USERS.items():
    if sid == request.sid:
      d_user = user

  print(f"{d_user} has disconnected")

@socketio.on("postUser")
def onPostUser(data):
  if data["username"] is not None:
    USERS[data["username"]] = request.sid
    emit("userResponse", {"username": data["username"], "success": True})
  else:
    emit("userResponse", {"success": False})

@socketio.on("requestAllRoom")
def onRequestAllRoom():
  emit("allRoomResponse", list(ROOMS.keys()))

@socketio.on("verifyRoom")
def onVerifyRoom(data):
  if data["room"] in ROOMS:
    emit("verifiedRoom", {"success": True, "room": data["room"]})
  else:
    emit("verifiedRoom", {"success": False})

@socketio.on("requestCurrentRoom")
def onRequestCurrentRoom(data):
  currentRoomMessage = []
  if data["room"] is not None and data["room"] in ROOMS:
    currentRoomMessage = list(ROOMS[data["room"]]["messages"])
  emit("roomMessageResponse", currentRoomMessage)

@socketio.on("newRoom")
def onNewRoom(data):
  if "room" in data and data["room"] not in ROOMS:
    ROOMS[data["room"]] = {}
    ROOMS[data["room"]]["messages"] = []
    emit("newRoomResponse", {"room": data["room"], "user": data["username"], "success": True}, broadcast=True)
  else:
    emit("newRoomResponse", {"success": False})
  
@socketio.on("newMessage")
def onNewMessage(data):
  room = data["room"]
  message = data["message"]
  if room is not None and message != "":
    msg = {
      "state": data["state"],
      "user": data["username"],
      "time": data["time"],
      "message": message
    }
    if room in ROOMS and len(ROOMS[room]["messages"]) == MSGLIMIT:
      ROOMS[room]["messages"].pop(0) 
    ROOMS[room]["messages"].append(msg)
    emit("newMessageResponse", {"msg": msg, "success": True}, room=room)
  elif message == "":
    emit("newMessageResponse", {"success": False, "error": "message_null"})
  else:
    emit("newMessageResponse", {"success": False, "error": "room_null"})

@socketio.on("join")
def onJoin(data):
  username = data["username"]
  room = data["room"]
  join_room(room)
  msg = {
      "state": "Public",
      "user": "FlackServer",
      "time": data["time"],
      "message": f"{username} has joined."
  }
  emit("newMessageResponse", {"msg": msg, "success": True}, room=room)  

@socketio.on("leave")
def onLeave(data):
  username = data["username"]
  room = data["room"]
  if room is not None:
    leave_room(room)
    msg = {
        "state": "Public",
        "user": "FlackServer",
        "time": data["time"],
        "message": f"{username} has left the room."
    }
    emit("newMessageResponse", {"msg": msg, "success": True}, room=room)

if __name__ == '__main__':
    socketio.run(app)
