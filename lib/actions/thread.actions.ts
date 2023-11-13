"use server"

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose"

interface Params {
    text: string,
    author: string,
    communityId: string | null,
    path: string
}

export async function createThread({ text, author, communityId, path}: Params) {
    
    try{
        connectToDB();
        const createdThread = await Thread.create({
            text,
            author,
            community: null
        })

        await User.findByIdAndUpdate(author, {
            $push: {threads: createdThread._id}
        })
        revalidatePath(path)
    }catch(error: any){
        throw new Error(`Failed to create Thread ${error.message}`)
    }
}


export async function fetchPosts(pageNumber = 1, pageSize=20){
    try{
        connectToDB();

        // const skipAmount = (pageNumber - 1) * pageSize

        // const fetchPostsQuery = Thread.find({ parentId: {$in: [undefined, null]}})
        // .sort({ createdAt: "desc"})
        // .skip(skipAmount)
        // .limit(pageSize)
        // .populate({ path: 'author', model: User })
        // .populate({
        //     path: 'children',
        //     populate: {
        //         path: 'author',
        //         model: User,
        //         select: "_id name parentId image"
        //     }
        // })

        // const totalPostsCount = 1

        const posts: never[] = [] //await fetchPostsQuery.exec()

        const isNext = false // totalPostsCount > (skipAmount + posts.length);

        return { posts, isNext }

    }catch(error: any){
        throw new Error(`Failed to fetch Posts: ${error.message}`)
    }
}


export async function fetchThreadById(id: string){
    try{
        connectToDB();

        // TODO populate community
        const thread = Thread.findById(id)
        .populate({
            path: 'author',
            model: User,
            select: "_id id name image"
        })
        .populate({
            path: 'children',
            populate: [
            {
                path: 'author',
                model: User,
                select: "_id id name parentId image"
            },
            {
                path: 'children',
                model: Thread,
                populate: {
                    path: 'author',
                    model: User,
                    select: "_id id name parentId image"
                }
            }
            ]
        }).exec();

        return thread
    }catch(error: any){
        throw new Error(`Error fetching Thread: ${error.message}`)
    }
}

export async function addCommentToThread(
    threadId: string,
    commentText: string,
    userId: string,
    path: string
){
    try{
        connectToDB();

        // Find the original thread by Id
        const originalThread = await Thread.findById(threadId)

        if(!originalThread){
            throw new Error("Thread not found")
        }


        const commentThread = new Thread({
            text: commentText,
            author: userId,
            parentId: threadId
        })

        const savedCommentThread = await commentThread.save()

        originalThread.children.push(savedCommentThread._id);

        await originalThread.save();

        revalidatePath(path)

    }catch(error: any) {
        throw new Error(`Error adding comment to thread: ${error.message}`)
    }
}