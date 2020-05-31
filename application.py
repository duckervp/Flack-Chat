from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

# Init app
app = Flask(__name__)
app.config['SECRET_KEY'] = b'dascvbzxvba!@*&^lguw;kb'
socketio = SocketIO(app)
# socketio = SocketIO(app, always_connect=True, engineio_logger=True)
# app.debug = True

# Global variable
USERS = {}
ROOMS = {}
MSGLIMIT = 100

# Main
@app.route("/")
def index():
  return render_template("index.html")

@socketio.on("disconnect")
def onDisconnect():
  d_user = ""
  d_room = ""
  for user, sid in USERS.items():
    if sid == request.sid:
      d_user = user
  for room in ROOMS:
    for member in ROOMS[room]["members"]:
      if member == d_user:
        d_room = room
        ROOMS[room]["members"].remove(member)
        break
    if d_room != "":
      break
  emit("disconnect", {"user":d_user, "room": d_room}, room=d_room)
  print(f"{d_user} {request.sid} has disconnected")

@socketio.on("announceDisconnect")
def onAnnounceDisconnect(data):
  if "room" in data and data["user"] is not None and data["user"] in USERS:
    username = data["user"]
    room = data["room"]
    msg = {
        "state": "Public",
        "user": "FlackServer",
        "sendTo": "All Room",
        "time": data["time"],
        "message": f"{username} has left the room."
    }
    emit("newMessageResponse", {"msg": msg, "success": True}, room=room) 

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

@socketio.on("requestRoomMember")
def onRequestRoomMembers(data):
  if "room" in data and data["room"] is not None and data["room"] in ROOMS:
    members = ROOMS[data["room"]]["members"]
    emit("roomMemberResponse", {"members": members})
    print("requestRoomMember", members)

@socketio.on("newRoom")
def onNewRoom(data):
  if "room" in data and data["room"] not in ROOMS:
    ROOMS[data["room"]] = {}
    ROOMS[data["room"]]["messages"] = []
    ROOMS[data["room"]]["members"] = []
    emit("newRoomResponse", {"room": data["room"], "user": data["username"], "success": True}, broadcast=True)
  else:
    emit("newRoomResponse", {"success": False})
  
@socketio.on("newMessage")
def onNewMessage(data):
  room = data["room"]
  user = data["username"]
  message = data["message"]
  sendTo = data["sendTo"]
  state = data["state"]
  if room is not None and message != "":
    msg = {
      "state": state,
      "user": user,
      "sendTo": sendTo,
      "time": data["time"],
      "message": message
    }
    if state == "Public":
      if room in ROOMS and len(ROOMS[room]["messages"]) == MSGLIMIT:
        ROOMS[room]["messages"].pop(0) 
      ROOMS[room]["messages"].append(msg)
      emit("newMessageResponse", {"msg": msg, "success": True}, room=room)
    elif sendTo in ROOMS[room]["members"]:
      if room in ROOMS and len(ROOMS[room]["messages"]) == MSGLIMIT:
        ROOMS[room]["messages"].pop(0) 
      ROOMS[room]["messages"].append(msg)
      if (sendTo != user):
        emit("newMessageResponse", {"msg": msg, "success": True}, room=USERS[user])
      emit("newMessageResponse", {"msg": msg, "success": True}, room=USERS[sendTo])
    else:
      emit("newMessageResponse", {"success": False, "error": "member_not_exist"})  
  elif message == "":
    emit("newMessageResponse", {"success": False, "error": "message_null"})
  else:
    emit("newMessageResponse", {"success": False, "error": "room_null"})

@socketio.on("join")
def onJoin(data):
  username = data["username"]
  room = data["room"]
  join_room(room)
  if username not in ROOMS[room]["members"]:
    ROOMS[room]["members"].append(username)
  msg = {
      "state": "Public",
      "user": "FlackServer",
      "sendTo": "All Room",
      "time": data["time"],
      "message": f"{username} has joined."
  }
  print(username, "joined", room)
  emit("memberJoin", {"member": username}, room=room)
  emit("newMessageResponse", {"msg": msg, "success": True}, room=room)  

@socketio.on("leave")
def onLeave(data):
  if data["username"] in USERS:
    username = data["username"]
    room = data["room"]
    if room is not None:
      leave_room(room)
      for member in ROOMS[room]["members"]:
        if member == username:
          ROOMS[room]["members"].remove(member)
      msg = {
          "state": "Public",
          "user": "FlackServer",
          "sendTo": "All Room",
          "time": data["time"],
          "message": f"{username} has left the room."
      }
      print(room,"members:", ROOMS[room]["members"])

      emit("memberLeave", {"member": username}, room=room)
      emit("newMessageResponse", {"msg": msg, "success": True}, room=room)

if __name__ == '__main__':
    socketio.run(app)
