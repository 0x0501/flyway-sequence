// In-memory todos storage
const todos : string[] = []

export type Todo = {
  id: number
  title: string
}

// Get the todos for a user
export function getTodos(): string[] {
  return todos
}

// Add an item to the todos
export function addTodo(title: string) {
  todos.push(title)
  return title
}
