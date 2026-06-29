import { useState } from 'react'

function CardPlayMode({ cards, playedCardIndices, onPlayCard, joinedPlayers }) {
  const availableCards = cards.filter(card => !playedCardIndices.includes(card.id))
  const [selectedCard, setSelectedCard] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const roles = ['Scientist', 'Failsafe', 'Adventist', 'Supremacist', 'Negotiator']

  const handleCardClick = (card) => {
    if (card.name === 'Silence' || card.name === 'SeizeControl') {
      setSelectedCard(card)
    } else {
      onPlayCard(card.id)
    }
  }

  const handleConfirmSilence = () => {
    if (selectedCard && selectedPlayer && selectedRole) {
      onPlayCard(selectedCard.id, selectedPlayer, selectedRole)
      setSelectedCard(null)
      setSelectedPlayer('')
      setSelectedRole('')
    }
  }

  const handleCancel = () => {
    setSelectedCard(null)
    setSelectedPlayer('')
    setSelectedRole('')
  }

  return (
    <div className="card-play-section">
      <h2>Play a Card</h2>
      <div className="available-cards">
        {availableCards.map((card) => (
          <button key={card.id} onClick={() => handleCardClick(card)}>
            {card.name}
          </button>
        ))}
      </div>

      {selectedCard && (selectedCard.name === 'Silence' || selectedCard.name === 'SeizeControl') && (
        <div className="silence-selection">
          <h3>Target Selection for {selectedCard.name}</h3>
          <div className="selection-group">
            <label>Target Player:</label>
            <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
              <option value="">Select a player</option>
              {joinedPlayers.map((player) => (
                <option key={player} value={player}>{player}</option>
              ))}
            </select>
          </div>
          <div className="selection-group">
            <label>Target Role:</label>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="selection-buttons">
            <button className="confirm-button" onClick={handleConfirmSilence} disabled={!selectedPlayer || !selectedRole}>
              Confirm
            </button>
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardPlayMode
