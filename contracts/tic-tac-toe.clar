(define-constant THIS_CONTRACT (as-contract tx-sender)) ;; The address of this contract itself
(define-constant ERR_MIN_BET_AMOUNT u100) ;; Error thrown when a player tries to create a game with a bet amount less than the minimum (0.0001 STX)
(define-constant ERR_INVALID_MOVE u101) ;; Error thrown when a move is invalid, i.e. not within range of the board or not an X or an O
(define-constant ERR_GAME_NOT_FOUND u102) ;; Error thrown when a game cannot be found given a Game ID, i.e. invalid Game ID
(define-constant ERR_GAME_CANNOT_BE_JOINED u103) ;; Error thrown when a game cannot be joined, usually because it already has two players
(define-constant ERR_NOT_YOUR_TURN u104) ;; Error thrown when a player tries to make a move when it is not their turn

;; The Game ID to use for the next game
(define-data-var latest-game-id uint u0)

(define-map games 
    uint ;; Key (Game ID)
    { ;; Value (Game Tuple)
        player-one: principal,
        player-two: (optional principal),
        is-player-one-turn: bool,

        bet-amount: uint,
        board: (list 9 uint),
        
        winner: (optional principal)
    }
)

(define-public (create-game (bet-amount uint) (move-index uint) (move uint))
    (let (
        ;; Get the Game ID to use for creation of this new game
        (game-id (var-get latest-game-id))
        ;; The initial starting board for the game with all cells empty
        (starting-board (list u0 u0 u0 u0 u0 u0 u0 u0 u0))
        ;; Updated board with the starting move played by the game creator (X)
        (game-board (unwrap! (replace-at? starting-board move-index move) (err ERR_INVALID_MOVE)))
        ;; Create the game data tuple (player one address, bet amount, game board, and mark next turn to be player two's turn)
        (game-data {
            player-one: contract-caller,
            player-two: none,
            is-player-one-turn: false,
            bet-amount: bet-amount,
            board: game-board,
            winner: none
        })
    )

    ;; Ensure that user has put up a bet amount greater than the minimum
    (asserts! (> bet-amount u0) (err ERR_MIN_BET_AMOUNT))
    ;; Ensure that the move being played is an `X`, not an `O`
    (asserts! (is-eq move u1) (err ERR_INVALID_MOVE))
    ;; Ensure that the move meets validity requirements
    (asserts! (validate-move starting-board move-index move) (err ERR_INVALID_MOVE))

    ;; Transfer the bet amount STX from user to this contract
    (try! (stx-transfer? bet-amount contract-caller THIS_CONTRACT))
    ;; Update the games map with the new game data
    (map-set games game-id game-data)
    ;; Increment the Game ID counter
    (var-set latest-game-id (+ game-id u1))

    ;; Log the creation of the new game
    (print { action: "create-game", data: game-data})
    ;; Return the Game ID of the new game
    (ok game-id)
))

(define-public (join-game (game-id uint) (move-index uint) (move uint))
    (let (
        ;; Load the game data for the game being joined, throw an error if Game ID is invalid
        (original-game-data (unwrap! (map-get? games game-id) (err ERR_GAME_NOT_FOUND)))
        ;; Get the original board from the game data
        (original-board (get board original-game-data))

        ;; Update the game board by placing the player's move at the specified index
        (game-board (unwrap! (replace-at? original-board move-index move) (err ERR_INVALID_MOVE)))
        ;; Update the copy of the game data with the updated board and marking the next turn to be player two's turn
        (game-data (merge original-game-data {
            board: game-board,
            player-two: (some contract-caller),
            is-player-one-turn: true
        }))
    )

    ;; Ensure that the game being joined is able to be joined
    ;; i.e. player-two is currently empty
    (asserts! (is-none (get player-two original-game-data)) (err ERR_GAME_CANNOT_BE_JOINED)) 
    ;; Ensure that the move being played is an `O`, not an `X`
    (asserts! (is-eq move u2) (err ERR_INVALID_MOVE))
    ;; Ensure that the move meets validity requirements
    (asserts! (validate-move original-board move-index move) (err ERR_INVALID_MOVE))

    ;; Transfer the bet amount STX from user to this contract
    (try! (stx-transfer? (get bet-amount original-game-data) contract-caller THIS_CONTRACT))
    ;; Update the games map with the new game data
    (map-set games game-id game-data)

    ;; Log the joining of the game
    (print { action: "join-game", data: game-data})
    ;; Return the Game ID of the game
    (ok game-id)
))

(define-public (play (game-id uint) (move-index uint) (move uint))
    (let (
        ;; Load the game data for the game being joined, throw an error if Game ID is invalid
        (original-game-data (unwrap! (map-get? games game-id) (err ERR_GAME_NOT_FOUND)))
        ;; Get the original board from the game data
        (original-board (get board original-game-data))

        ;; Is it player one's turn?
        (is-player-one-turn (get is-player-one-turn original-game-data))
        ;; Get the player whose turn it currently is based on the is-player-one-turn flag
        (player-turn (if is-player-one-turn (get player-one original-game-data) (unwrap! (get player-two original-game-data) (err ERR_GAME_NOT_FOUND))))
        ;; Get the expected move based on whose turn it is (X or O?)
        (expected-move (if is-player-one-turn u1 u2))

        ;; Update the game board by placing the player's move at the specified index
        (game-board (unwrap! (replace-at? original-board move-index move) (err ERR_INVALID_MOVE)))
        ;; Check if the game has been won now with this modified board
        (is-now-winner (has-won game-board))
        ;; Merge the game data with the updated board and marking the next turn to be player two's turn
        ;; Also mark the winner if the game has been won
        (game-data (merge original-game-data {
            board: game-board,
            is-player-one-turn: (not is-player-one-turn),
            winner: (if is-now-winner (some player-turn) none)
        }))
    )

    ;; Ensure that the function is being called by the player whose turn it is
    (asserts! (is-eq player-turn contract-caller) (err ERR_NOT_YOUR_TURN))
    ;; Ensure that the move being played is the correct move based on the current turn (X or O)
    (asserts! (is-eq move expected-move) (err ERR_INVALID_MOVE))
    ;; Ensure that the move meets validity requirements
    (asserts! (validate-move original-board move-index move) (err ERR_INVALID_MOVE))