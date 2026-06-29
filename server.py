import asyncio
import websockets
import argparse
from typing import Dict, Set, List, Optional
import random
import uuid

verbose = False


class Player:
    def __init__(self, name: str, websocket):
        self.name = name
        self.websocket = websocket
        self.role = None
        self.silenced = False
        self.cards = []
        self.card_played = None
        self.card_extra_info = None
        self.voted = False
        self.voted_for = None
        self.ready = False


class Game:
    def __init__(self, game_id: str, min_players: int = 1):
        self.game_id = game_id
        self.players: Dict[str, Player] = {}
        self.ready_players: Set[str] = set()
        self.game_started = False
        self.min_players = min_players
        self.alien_alignment = random.choice(["Peaceful", "Invading"])
        self.launches = 0
        self.launched_nukes = False
        self.round = 0
        self.failsafe_pressed = False

    def count_players(self) -> int:
        """Count the number of remaining players in the game."""
        count = 0
        for player in self.players.values():
            if not player.silenced:
                count += 1
        return count

    def add_player(self, player_name: str, websocket):
        """Add a player to the game."""
        if player_name not in self.players:
            self.players[player_name] = Player(player_name, websocket)

    def remove_player(self, player_name: str):
        """Remove a player from the game."""
        if player_name in self.players:
            del self.players[player_name]
            self.ready_players.discard(player_name)

    def mark_ready(self, player_name: str):
        """Mark a player as ready."""
        self.ready_players.add(player_name)

    def can_start(self) -> bool:
        """Check if the game can start."""
        return (len(self.ready_players) >= len(self.players) and
                len(self.ready_players) >= self.min_players and
                not self.game_started)

    def start(self):
        """Start the game."""
        self.game_started = True
        self.assign_roles()

    def assign_roles(self):
        """Assign roles to all players."""
        roles = ["Scientist"] * 4 + ["Failsafe"] * 4 + ["Adventist"] * 6 + ["Supremacist"] * 6 + ["Negotiator"] * 6
        random.shuffle(roles)
        for i, player in enumerate(self.players.values()):
            player.role = roles[i]
        for player in self.players.values():
            player.cards = ["Investigate", "Launch", "Silence"]
            if player.role in ["Scientist", "Adventist", "Negotiator"]:
                player.cards.append("MakeContact")
            elif player.role == "Failsafe":
                player.cards.append("Investigate")
            elif player.role == "Supremacist":
                player.cards.append("SeizeControl")

            if verbose:
                print(f"[ROLE ASSIGNMENT] {player.name}: {player.role}, {player.cards}")

    async def process_card_play(self, player_name: str, card: str, role: str = None, target_player: str = None):
        """Process a card played by a player."""
        if player_name in self.players:
            self.players[player_name].card_played = card
            self.players[player_name].card_extra_info = [role, target_player]
        if len([p for p in self.players.values() if p.card_played is not None]) >= self.count_players():
            # All players have played a card
            await self.do_card_resolution()

    async def process_vote(self, vote: str, player: str):
        """Process a vote from a player."""
        if player in self.players:
            self.players[player].voted = True
            self.players[player].voted_for = vote
        if len([p for p in self.players.values() if p.voted]) >= self.count_players():
            # All players have voted
            await self.do_vote_resolution()

    async def process_failsafe(self):
        """Process the failsafe button press."""
        self.failsafe_pressed = True
        await broadcast_message("FailsafePressed", self.game_id)

    def check_game_end(self):
        """Check if the game has ended and determine winners."""
        pass

    async def do_card_resolution(self):
        """Handle card resolution after all players have played."""
        if verbose:
            print("[CARD RESOLUTION] Starting card resolution")
        def get_priority(player):
            if not player.card_played:
                return 100
            if player.card_played == "Silence" or player.card_played == "SeizeControl":
                return 1
            elif player.card_played == "MakeContact":
                if player.role == "Failsafe":
                    return 2
                elif player.role == "Adventist":
                    return 3
                else:
                    return 4
            elif player.card_played == "Investigate":
                return 5
            elif player.card_played == "Launch":
                return 6
            else:
                return 7
        player_order = sorted(self.players.values(), key=get_priority)
        cards_played = []
        self.launches = 0
        for player in player_order:
            if not player.card_played:
                continue
            if player.card_played == "Silence" or player.card_played == "SeizeControl":
                # if the provided player has the provided role, silence them
                target_player = player.card_extra_info[1]
                target_role = player.card_extra_info[0]
                if self.players[target_player].role == target_role:
                    self.players[target_player].silenced = True
                    cards_played.append(f"{player.card_played},{target_player},{target_role},True")

                    if verbose:
                        print(f"[CARD RESOLUTION] {player.name} silenced {target_player}")
                else:
                    cards_played.append(f"{player.card_played},{target_player},{target_role},False")
                if player.card_played == "SeizeControl":
                    self.launches += 1

            elif player.card_played == "MakeContact":
                if not player.silenced:
                    if player.role == "Negotiator":
                        self.alien_alignment = "Peaceful"
                    elif player.role == "Adventist":
                        self.alien_alignment = "Invading"
                    await send_to_player(player.name, f"AlienAlignment:{self.alien_alignment}")
                cards_played.append("MakeContact")
            elif player.card_played == "Investigate":
                # send the player the source of every card played
                player_card_combos = []
                for p in self.players.values():
                    if p.card_played:
                        player_card_combos.append(f"{p.name},{p.card_played}")
                await send_to_player(player.name, f"CardSources:{','.join(player_card_combos)}")
                cards_played.append("Investigate")
            elif player.card_played == "Launch":
                self.launches += 1
                cards_played.append("Launch")

        for player in self.players.values():
            player.card_played = None
            player.card_extra_info = None

        await broadcast_message(f"CardsPlayed:{','.join(cards_played)}", self.game_id)
        await broadcast_message("VoteStart", self.game_id)

        
    async def do_vote_resolution(self):
        """Process the vote resolution."""
        yeses = 0
        noes = 0
        for player in self.players.values():
            if (not player.voted) or player.silenced:
                continue
            if player.voted_for == "yes":
                yeses += 1
            elif player.voted_for == "no":
                noes += 1
        if verbose:
            print(f"[VOTE RESOLUTION] Yeses: {yeses}, Noes: {noes}, Launches: {self.launches}")
        await broadcast_message(f"VotesCast:{yeses},{noes},{self.launches}", self.game_id)

        for player in self.players.values():
            player.voted = False
            player.voted_for = None

        if yeses + self.launches > noes and not self.failsafe_pressed:
            self.launched_nukes = True
            await self.do_game_end()
        else:
            self.round += 1
            if self.round == 4:
                await self.do_game_end()
            else:
                await broadcast_message("CardPlayStart", self.game_id)

    async def do_game_end(self):
        """Process the game end."""
        winning_players = []
        for player in self.players.values():
            if player.role == "Scientist" or player.role == "Failsafe":
                if self.launched_nukes ^ (self.alien_alignment == "Peaceful"):
                    winning_players.append(player.name)
            elif player.role == "Supremacist":
                if self.launched_nukes:
                    winning_players.append(player.name)
            elif player.role == "Adventist":
                if (not self.launched_nukes) and (self.alien_alignment == "Invading"):
                    winning_players.append(player.name)
            elif player.role == "Negotiator":
                if not self.launched_nukes:
                    winning_players.append(player.name)
            else:
                # Unknown role, don't count as winner
                print(f"Unknown role: {player.role}")

        role_list = [(player.name, player.role) for player in self.players.values()]
        await broadcast_message(f"GameEnd:{self.launched_nukes},{self.alien_alignment}:{','.join(winning_players)}:{','.join([f'{name},{role}' for name, role in role_list])}", self.game_id)
        self.reset_game()

    def reset_game(self):
        """Reset the game state for a new game."""
        self.game_started = False
        self.ready_players.clear()
        self.alien_alignment = random.choice(["Peaceful", "Invading"])
        self.launches = 0
        self.launched_nukes = False
        self.round = 0
        for player in self.players.values():
            player.role = None
            player.silenced = False
            player.cards = []
            player.card_played = None
            player.card_extra_info = None
            player.voted = False
            player.voted_for = None


class GameManager:
    def __init__(self):
        self.games: Dict[str, Game] = {}
        self.lobby: Dict[str, Player] = {}  # Players waiting for a game
        self.min_players = 1

    def add_to_lobby(self, player_name: str, websocket):
        """Add a player to the lobby."""
        self.lobby[player_name] = Player(player_name, websocket)

    def remove_from_lobby(self, player_name: str):
        """Remove a player from the lobby."""
        if player_name in self.lobby:
            del self.lobby[player_name]

    def mark_lobby_ready(self, player_name: str):
        """Mark a lobby player as ready."""
        if player_name in self.lobby:
            self.lobby[player_name].ready = True

    def can_create_game(self) -> bool:
        """Check if enough players are ready to create a game."""
        ready_players = [p for p in self.lobby.values() if getattr(p, 'ready', False)]
        return len(ready_players) >= len(self.lobby) and len(ready_players) >= self.min_players

    def create_game(self) -> Optional[Game]:
        """Create a new game with all lobby players and clear the lobby."""
        if not self.can_create_game():
            return None

        game_id = str(uuid.uuid4())
        game = Game(game_id, self.min_players)

        # Move all lobby players to the new game
        for player_name, player in list(self.lobby.items()):
            game.players[player_name] = player
            game.ready_players.add(player_name)
            del self.lobby[player_name]

        self.games[game_id] = game
        return game

    def get_player_game(self, player_name: str) -> Optional[Game]:
        """Find which game a player is in."""
        for game in self.games.values():
            if player_name in game.players:
                return game
        return None

    def remove_player_from_game(self, player_name: str):
        """Remove a player from their current game."""
        game = self.get_player_game(player_name)
        if game:
            game.remove_player(player_name)
            # Clean up empty games
            if len(game.players) == 0:
                del self.games[game.game_id]

    async def broadcast_to_game(self, game_id: str, message: str):
        """Broadcast a message to all players in a specific game."""
        if game_id in self.games:
            for player in self.games[game_id].players.values():
                try:
                    await player.websocket.send(message)
                except:
                    pass

    async def broadcast_to_lobby(self, message: str):
        """Broadcast a message to all players in the lobby."""
        for player in self.lobby.values():
            try:
                await player.websocket.send(message)
            except:
                pass



# Global game manager instance
game_manager = GameManager()

async def broadcast_message(message: str, game_id: str = None):
    """Send a message to all connected players in a game or lobby."""
    if verbose:
        print(f"[BROADCAST] {message}")
    if game_id:
        await game_manager.broadcast_to_game(game_id, message)
    else:
        await game_manager.broadcast_to_lobby(message)

async def send_to_player(player_name: str, message: str):
    """Send a message to a specific player."""
    if verbose:
        print(f"[TO {player_name}] {message}")
    # Check if player is in a game
    game = game_manager.get_player_game(player_name)
    if game and player_name in game.players:
        try:
            await game.players[player_name].websocket.send(message)
        except:
            pass
    # Check if player is in lobby
    elif player_name in game_manager.lobby:
        try:
            await game_manager.lobby[player_name].websocket.send(message)
        except:
            pass

def parse_message(message: str) -> tuple:
    """Parse incoming message into type and payload."""
    if ":" in message:
        parts = message.split(":", 1)
        return parts[0], parts[1]
    return message, ""

# ============ MESSAGE HANDLERS ============

async def handle_looking_for_game(player_name: str, websocket):
    """Handle a new player looking for a game."""
    game_manager.add_to_lobby(player_name, websocket)
    # Send list of all lobby players to everyone
    all_players = ",".join(game_manager.lobby.keys())
    await broadcast_message(f"PlayerJoined:{all_players}")

async def handle_ready_to_start(player_name: str):
    """Handle a player ready to start."""
    # Check if player is in a finished game and move them to lobby
    game = game_manager.get_player_game(player_name)
    if game and not game.game_started:
        # Game has ended, move player to lobby
        player = game.players.get(player_name)
        if player:
            game_manager.add_to_lobby(player_name, player.websocket)
            game.remove_player(player_name)
            # Clean up empty games
            if len(game.players) == 0:
                del game_manager.games[game.game_id]

    # Mark player as ready in lobby
    game_manager.mark_lobby_ready(player_name)
    if verbose:
        print(f"[READY] {player_name}")
        print(f"[READY] Total ready: {len([p for p in game_manager.lobby.values() if getattr(p, 'ready', False)])}")
    if game_manager.can_create_game():
        if verbose:
            print("Game started!")

        game = game_manager.create_game()
        if game:
            game.start()

            # Send RoleGiven messages
            for pname, player in game.players.items():
                cards_str = ",".join(player.cards)
                role_str = player.role if player.role else ""
                await send_to_player(pname, f"RoleGiven:{role_str},{cards_str}")

async def handle_card_play(payload: str, player_name: str):
    """Handle a card played by a player."""
    parts = payload.split(",")
    card = parts[0]
    role = parts[1] if len(parts) > 1 else None
    target_player = parts[2] if len(parts) > 2 else None
    game = game_manager.get_player_game(player_name)
    if game:
        await game.process_card_play(player_name, card, role, target_player)

async def handle_vote(payload: str, player_name: str):
    """Handle a vote from a player."""
    vote = payload
    game = game_manager.get_player_game(player_name)
    if game:
        await game.process_vote(vote, player_name)

async def handle_failsafe():
    """Handle the failsafe button press."""
    # Find the game with a Failsafe player
    for game in game_manager.games.values():
        for player in game.players.values():
            if player.role == "Failsafe":
                await game.process_failsafe()
                return

async def handle_client(websocket):
    """Handle a client connection."""
    player_name = None
    if verbose:
        print("Client connected")
    try:
        async for message in websocket:
            if verbose:
                print(f"[FROM {player_name or 'unknown'}] {message}")
            msg_type, payload = parse_message(message)
            
            if msg_type == "LookingForGame":
                player_name = payload
                await handle_looking_for_game(player_name, websocket)
                
            elif msg_type == "ReadyToStart":
                if player_name:
                    await handle_ready_to_start(player_name)
                    
            elif msg_type == "CardPlayed":
                if player_name:
                    await handle_card_play(payload, player_name)
                    
            elif msg_type == "Vote":
                if player_name:
                    await handle_vote(payload, player_name)
                    
            elif msg_type == "PressFailsafe":
                await handle_failsafe()

            else:
                if verbose:
                    print(f"Unknown message type: {msg_type}")
                
    except websockets.exceptions.ConnectionClosed:
        if verbose:
            print("Client disconnected")
        pass
    finally:
        if player_name:
            if verbose:
                print(f"Removing player: {player_name}")
            # Remove from lobby if there
            game_manager.remove_from_lobby(player_name)
            # Remove from game if there
            game_manager.remove_player_from_game(player_name)

async def main():
    """Start the websocket server."""
    print("Server starting on ws://localhost:8765")
    async with websockets.serve(handle_client, "localhost", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dark Forest Server")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    args = parser.parse_args()
    
    verbose = args.verbose
    if verbose:
        print("Verbose mode enabled")
    asyncio.run(main())
