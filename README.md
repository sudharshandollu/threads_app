import os
from typing import List

import streamlit as st

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

# ============================================================
# BASIC SETUP
# ============================================================

st.set_page_config(
    page_title="LangChain Chatbot",
    page_icon="💬",
    layout="wide",
)

# Make sure your OpenAI key is set:
# export OPENAI_API_KEY="sk-..."
if "OPENAI_API_KEY" not in os.environ:
    st.warning("⚠️ OPENAI_API_KEY not set in environment. Set it before running.")


# ============================================================
# SESSION STATE
# ============================================================

if "chat_history" not in st.session_state:
    st.session_state.chat_history: List[BaseMessage] = []

if "context_text" not in st.session_state:
    st.session_state.context_text = ""  # concatenated text from uploaded files

if "selected_model" not in st.session_state:
    st.session_state.selected_model = "gpt-4.1-mini"


# ============================================================
# LANGCHAIN: MODEL + PROMPT CHAIN
# ============================================================

def get_llm(model_name: str) -> ChatOpenAI:
    """Return a LangChain ChatOpenAI instance for the selected model."""
    return ChatOpenAI(
        model=model_name,
        temperature=0.3,
    )


prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a helpful AI assistant.\n\n"
            "You have access to the following user-provided context (may be empty):\n"
            "{context}\n\n"
            "Use the context when it is relevant to the user's question. "
            "If the context is not relevant, ignore it."
        ),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ]
)


def run_chain(
    model_name: str,
    user_input: str,
    chat_history: List[BaseMessage],
    context: str,
) -> AIMessage:
    """Run the LangChain chat with context + history and return AIMessage."""
    llm = get_llm(model_name)
    chain = prompt | llm

    result = chain.invoke(
        {
            "input": user_input,
            "chat_history": chat_history,
            "context": context,
        }
    )
    # result is a BaseMessage (AIMessage)
    return result


# ============================================================
# FILE HANDLING (SIMPLE TEXT EXTRACTION)
# ============================================================

def read_uploaded_file(uploaded_file) -> str:
    """
    Convert uploaded file into text.

    This simple example:
    - Handles text-like files (txt, md, csv, etc.)
    - For other types, returns a placeholder note.
    Extend this with PDF/doc loaders as needed.
    """
    file_name = uploaded_file.name.lower()

    try:
        # Handle text files
        if uploaded_file.type.startswith("text/") or file_name.endswith(".txt"):
            return uploaded_file.read().decode("utf-8", errors="ignore")

        # You can add PDF support here with PyPDF2 or pypdf, e.g.:
        # elif file_name.endswith(".pdf"):
        #     from pypdf import PdfReader
        #     reader = PdfReader(uploaded_file)
        #     text = "\n".join(page.extract_text() or "" for page in reader.pages)
        #     return text

        else:
            return f"[Unsupported file type: {uploaded_file.name}]\n"

    except Exception as e:
        return f"[Error reading file {uploaded_file.name}: {e}]\n"


def update_context_from_files(files):
    """Update session_state.context_text from uploaded files."""
    all_texts = []
    for f in files:
        all_texts.append(f"--- File: {f.name} ---\n")
        all_texts.append(read_uploaded_file(f))
        all_texts.append("\n\n")

    st.session_state.context_text = "\n".join(all_texts)


# ============================================================
# SIDEBAR: SETTINGS, FILE UPLOADS, CHAT SNAPSHOT
# ============================================================

with st.sidebar:
    st.title("⚙️ Controls")

    # Model selection
    model_options = [
        "gpt-4.1-mini",
        "gpt-4.1",
        "o3-mini",
    ]
    selected_model = st.selectbox(
        "Select model",
        model_options,
        index=model_options.index(st.session_state.selected_model)
        if st.session_state.selected_model in model_options
        else 0,
    )
    st.session_state.selected_model = selected_model

    # File upload
    st.markdown("### 📎 Upload files for context")
    uploaded_files = st.file_uploader(
        "Upload one or more files",
        type=["txt", "md", "csv", "log", "pdf"],  # extend if you implement more loaders
        accept_multiple_files=True,
    )

    if uploaded_files:
        update_context_from_files(uploaded_files)
        st.success("Context updated from uploaded files.")
    else:
        st.caption("No files uploaded. Chat will not use extra context.")

    # Clear buttons
    st.markdown("---")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🧹 Clear chat"):
            st.session_state.chat_history = []
            st.experimental_rerun()
    with col2:
        if st.button("🧹 Clear context"):
            st.session_state.context_text = ""
            st.experimental_rerun()

    st.markdown("---")
    st.subheader("📝 Chat Snapshot")

    if not st.session_state.chat_history:
        st.caption("No messages yet.")
    else:
        for i, msg in enumerate(st.session_state.chat_history, start=1):
            role = "User" if isinstance(msg, HumanMessage) else "Assistant"
            icon = "👤" if isinstance(msg, HumanMessage) else "🤖"
            text = msg.content.strip().replace("\n", " ")
            if len(text) > 60:
                text = text[:60] + "..."
            st.markdown(f"**{i}. {icon} {role}**\n> {text}")


# ============================================================
# MAIN CHAT UI
# ============================================================

st.title("💬 LangChain Chatbot")

# Show current model + context status
ctx_status = "✅" if st.session_state.context_text.strip() else "⚪️"
st.caption(
    f"Model: **{st.session_state.selected_model}** | "
    f"Context from files: {ctx_status}"
)

# Display full conversation
for msg in st.session_state.chat_history:
    if isinstance(msg, HumanMessage):
        role = "user"
    else:
        role = "assistant"

    with st.chat_message(role):
        st.markdown(msg.content)

# Chat input
user_input = st.chat_input("Type your message...")

if user_input:
    # 1. Add user message to history
    user_msg = HumanMessage(content=user_input)
    st.session_state.chat_history.append(user_msg)

    # 2. Run LangChain chain
    try:
        ai_msg = run_chain(
            model_name=st.session_state.selected_model,
            user_input=user_input,
            chat_history=st.session_state.chat_history,
            context=st.session_state.context_text,
        )
    except Exception as e:
        ai_msg = AIMessage(
            content=f"⚠️ Error calling model `{st.session_state.selected_model}`: {e}"
        )

    # 3. Append AI message to history
    st.session_state.chat_history.append(ai_msg)

    # 4. Rerun to display updated conversation
    st.experimental_rerun()
