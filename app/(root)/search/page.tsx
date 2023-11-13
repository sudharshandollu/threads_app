import UserCard from "@/components/cards/UserCard";
import { fetchUser, fetchUsers } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs"
import { redirect } from "next/navigation";

const Page = async () => {

    const user = await currentUser();

    if (!user) return null;

    const userInfo = await fetchUser(user.id)

    if(!userInfo?.onboarded) redirect("/onboarding")

    // Fetch users

    const result = await fetchUsers({
        userId: user.id,
        searchString: "",
        pageNumber: 1,
        pageSize: 25,
        sortBy: 'desc'
    })

    

  return (
    <section>
        <h1 className="head-text mb-10">Search</h1>
        {
            result.users.length === 0?
            <p>No users</p>:
            <>
            {
                result.users.map(person => (
                    <UserCard
                        key={person.id}
                        id={person.id}
                        name={person.name}
                        username={person.username}
                        imgUrl={person.image}
                        personType="User"
                    />
                ))
            }
            </>
        }
    </section>
  )
}

export default Page