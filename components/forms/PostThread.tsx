"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {useForm } from "react-hook-form";
import { 
    Form,
    FormField, 
    FormItem,
    FormLabel,
    FormControl,
    FormMessage
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ThreadValidation } from "@/lib/validations/threads";
import { useRouter, usePathname } from "next/navigation";
import { createThread } from "@/lib/actions/thread.actions";
import { z } from "zod";
import { Button } from "../ui/button";

function PostThread ({userId}: {userId: string}) {
    const router = useRouter();
    const pathname = usePathname();

    const form = useForm({
        resolver: zodResolver(ThreadValidation),
        defaultValues: {
            thread: '',
            accountId: userId
        }
    }
    )

    const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
        await createThread({
            text: values.thread,
            author: userId,
            communityId: null,
            path: pathname
        });

        router.push("/")
    }

    return(
        <Form {...form}>
          <form 
          onSubmit={form.handleSubmit(onSubmit)} 
          className="mt-10 flex flex-col justify-start gap-10">
            <FormField
              control={form.control}
              name="thread"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-3 w-full">
                  <FormLabel className="text-base-semibold text-light-2">
                    Content
                  </FormLabel>
                  <FormControl className="no-focus border border-dark-4 bg-dark-3 text-light-1">
                    <Textarea
                        rows={15}
                        {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="bg-primary-500">Post Thread</Button>
          </form>
        </Form>
    )
}

export default PostThread