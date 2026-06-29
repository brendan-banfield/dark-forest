function CardsPlayedDisplay({ cardsPlayed, cardSources }) {
  const getSourceForCard = (cardType, index) => {
    // Find the source for this card by matching the card type
    // Since cards can have duplicates, we need to track which ones we've used
    const matchingSources = cardSources.filter(s => s.card === cardType)
    // Return the source at the same index if available, otherwise the first match
    if (index < matchingSources.length) {
      return matchingSources[index]
    }
    return matchingSources[0] || null
  }

  return (
    <div className="cards-played-section">
      <h2>Cards Played This Round</h2>
      <div className="cards-played-list">
        {cardsPlayed.map((card, i) => {
          const source = getSourceForCard(card.type, i)
          return (
            <div key={i} className="card-played">
              {card.type === 'Silence' || card.type === 'SeizeControl' ? (
                <div>
                  <span className="card-name">{card.type}</span>
                  {card.targetPlayer && card.targetRole && (
                    <span className="card-details">
                      {' '}silencing {card.targetPlayer} as {card.targetRole}
                      {card.success !== undefined && (
                        <span className={card.success ? 'success' : 'failure'}>
                          {' - '}{card.success ? 'Success' : 'Failed'}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ) : (
                <span className="card-name">{card.type}</span>
              )}
              {source && (
                <span className="card-details">
                  {' '}from <span className="source-player">{source.player}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CardsPlayedDisplay
