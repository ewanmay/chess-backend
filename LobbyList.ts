const Lobby = require('./Lobby')

class LobbyList {

  io: any
  db: any
  lobbies: typeof Lobby[]
  
  constructor(io, db) {
    this.io = io
    this.db = db
    this.lobbies = []
  }

  /*
   *  Creates a randomly generated code that is not currently being used by any lobby.
   */
  async createNewLobbyCode(): Promise<string> {
    let lobbyCode = this.makeId()
    // await this.db.
    while (this.lobbies.filter((l) => l.lobbyCode === lobbyCode).length) {
      lobbyCode = this.makeId()
    }
    return lobbyCode
  }

  /*
   *  Returns randomly generated abitrary string with a length of 4.
   */
  makeId(): string {
    const ID_LENGTH = 4
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < ID_LENGTH; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }

  /*
   *  Creates a new lobby with a unique identifier.
   *  Returns:
   *  - lobby: the lobby object that was just created.
   */
  addNewLobby() {
    const lobbyCode = this.createNewLobbyCode()
    const lobby = new Lobby(this.io, this.db, 'AAAA')
    this.lobbies.push(lobby)
    return lobbyCode
  }

  /*
   *  Will add a user to a lobby based on the lobby code provided.
   *
   * Returns:
   * - lobby: if exists, returns the lobby object. else, returns undefined
   */
  addUserToLobby(lobbyCode, username, socket) {
    console.log("Adding User to Lobby", username, lobbyCode)
    const lobby = this.lobbies.find((value) => value.lobbyCode === lobbyCode)
    if (!lobby) {
      socket.emit('join-lobby-err', 'Lobby Not Found!')
    } else {
      lobby.addUserToLobby(username, socket)
    }
    return lobby
  }

  /*
   *  Delete this user from all lobbies they are in.
   *  If lobby becomes empty, delete it.
   */
  removeUserFromLobbies(username) {
    const filteredLobbies = this.lobbies.filter((lobby) => {
      const wasRemoved = lobby.removeUserFromLobby(username) 
      if(wasRemoved && lobby.lobbySize() === 0){
          return false // filter out the lobby
      }
      else return true // keep the lobby
    })
    this.lobbies = filteredLobbies
  }
}

module.exports = LobbyList
