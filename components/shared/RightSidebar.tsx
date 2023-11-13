function RightSidebar() {
    return(
        <section className="custom-scrollbar rightsidebar">
            <div className="flex flex-1 flex-col justify-start">
                <h3 className="text-heading4-medium text-light-1">Suggested Communities</h3>
                <p className="mt-2 text-light-4">No Suggestions yet</p>
            </div>
            <div className="flex flex-1 flex-col justify-start">
                <h3 className="text-heading4-medium text-light-1">Suggested Users</h3>
                <p className="mt-2 text-light-4">No Suggestions yet</p>
            </div>
        </section>
    )
}

export default RightSidebar