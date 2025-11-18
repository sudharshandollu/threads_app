import streamlit as st

# -----------------------------
# Page & Session Configuration
# -----------------------------
st.set_page_config(
    page_title="AI Chatbot",
    page_icon="💬",
    layout="wide",
)

# Initialize session state for messages and model
if "messages" not in st.session_state:
    # Each message: {"role": "user"/"assistant", "content": "...", "model": "model_name"}
    st.session_state.messages = []

if "selected_model" not in st.session_state:
    st.session_state.selected_model = "gpt-4.1"  # default; replace with your real model name


# -----------------------------
# Your model call (plug your code here)
# -----------------------------
def call_ai_model(model_name: str, messages: list[dict]) -> str:
    """
    This is a placeholder.
    Replace this with your actual AI model call.

    Example (pseudo):
        response = my_client.chat.completions.create(
            model=model_name,
            messages=messages,
        )
        return response.choices[0].message.content
    """
    # --- DUMMY IMPLEMENTATION (echo) ---
    last_user_msg = [m for m in messages if m["role"] == "user"][-1]["content"]
    return f"[{model_name}] Echo: {last_user_msg}"


# -----------------------------
# Sidebar: Model & Chat History
# -----------------------------
with st.sidebar:
    st.title("⚙️ Settings")

    # Model selection dropdown
    model_options = [
        "gpt-4.1",
        "gpt-4.1-mini",
        "my-local-model",
        "ollama-llama3",
    ]  # replace with your actual list
    selected_model = st.selectbox(
        "Select AI Model",
        model_options,
        index=model_options.index(st.session_state.selected_model)
        if st.session_state.selected_model in model_options
        else 0,
    )
    st.session_state.selected_model = selected_model

    # Clear chat button
    if st.button("🧹 Clear Chat"):
        st.session_state.messages = []
        st.experimental_rerun()

    st.markdown("---")
    st.subheader("📝 Chat History")

    if not st.session_state.messages:
        st.caption("No messages yet. Start chatting!")
    else:
        # Show compact view of all messages in the sidebar
        for i, msg in enumerate(st.session_state.messages, start=1):
            role_icon = "👤" if msg["role"] == "user" else "🤖"
            short_text = msg["content"].strip().replace("\n", " ")
            if len(short_text) > 60:
                short_text = short_text[:60] + "..."
            st.markdown(
                f"**{i}. {role_icon} {msg['role'].capitalize()}** "
                f"(_{msg.get('model', 'N/A')}_)\n\n> {short_text}"
            )


# -----------------------------
# Main Chat UI
# -----------------------------
st.title("💬 AI Chatbot")

# Show current model in use
st.caption(f"Current model: **{st.session_state.selected_model}**")

# Render full conversation in the main area
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        # Optionally show model tag for assistant messages
        if msg["role"] == "assistant":
            st.markdown(f"*Model:* `{msg.get('model', 'N/A')}`")
        st.markdown(msg["content"])

# Chat input at the bottom
user_input = st.chat_input("Type your message...")

if user_input:
    # 1) Add user message to history
    st.session_state.messages.append(
        {
            "role": "user",
            "content": user_input,
            "model": st.session_state.selected_model,  # optional
        }
    )

    # 2) Call the AI model with full history
    try:
        assistant_reply = call_ai_model(
            st.session_state.selected_model,
            [{"role": m["role"], "content": m["content"]} for m in st.session_state.messages],
        )
    except Exception as e:
        assistant_reply = f"Error calling model `{st.session_state.selected_model}`: {e}"

    # 3) Store assistant message
    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": assistant_reply,
            "model": st.session_state.selected_model,
        }
    )

    # 4) Rerun to immediately show the new messages
    st.experimental_rerun()





from openai import OpenAI

client = OpenAI()

def call_ai_model(model_name: str, messages: list[dict]) -> str:
    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
    )
    return response.choices[0].message.content


    
