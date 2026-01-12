"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Calendar, Mail, Phone, Building2, User, Send, CheckCircle2, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/landing/ui/dialog"
import { Button } from "@/components/landing/ui/button"
import { Input } from "@/components/landing/ui/input"
import { Textarea } from "@/components/landing/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/landing/ui/form"
import { motion, AnimatePresence } from "framer-motion"

interface BookDemoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  company: z.string().min(2, "Company name is required"),
  phone: z.string().optional(),
  message: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function BookDemoModal({ open, onOpenChange }: BookDemoModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  // Reset states when modal closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setIsSuccess(false)
        setIsSubmitting(false)
      }, 300)
    }
  }, [open])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      message: "",
    },
  })

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    console.log("Form submitted:", data)
    setIsSubmitting(false)
    setIsSuccess(true)
    
    // Reset form and close modal after delay
    setTimeout(() => {
      setIsSuccess(false)
      form.reset()
      onOpenChange(false)
    }, 2500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-12 text-center"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Request Submitted</h3>
              <p className="text-muted-foreground">We'll be in touch shortly.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <DialogHeader className="p-8 pb-0 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-black/5 dark:bg-white/10 rounded-xl">
                    <Calendar className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                <DialogTitle className="text-2xl font-bold text-foreground">
                  Book a Demo
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground mt-2">
                  Schedule a 30-minute call with our product specialist. No pitch, just insights.
                </DialogDescription>
              </DialogHeader>

              <div className="p-8 pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <User className="w-3.5 h-3.5" />
                              Full Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John Doe"
                                className="h-11 bg-slate-50 border-transparent focus:border-black focus:ring-0 transition-all font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              Email
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="john@company.com"
                                className="h-11 bg-slate-50 border-transparent focus:border-black focus:ring-0 transition-all font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Building2 className="w-3.5 h-3.5" />
                              Company
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Acme Inc."
                                className="h-11 bg-slate-50 border-transparent focus:border-black focus:ring-0 transition-all font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" />
                              Phone
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                className="h-11 bg-slate-50 border-transparent focus:border-black focus:ring-0 transition-all font-medium"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Additional Notes
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about your use case..."
                              className="min-h-[100px] resize-none bg-slate-50 border-transparent focus:border-black focus:ring-0 transition-all font-medium"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Optional - help us prepare for our conversation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-2">
                       <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 h-12 font-semibold"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-[2] h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            Schedule Demo
                            <Send className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

