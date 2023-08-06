new class {
    constructor() {
        document.addEventListener('DOMContentLoaded', _ => {
            this.ws = new u_socket(this.auth_data, (my_data) => this.init(my_data))
            this.original_title = document.title

            this.left_side_visible = true
            this.right_side_visible = true
            this.init_dom()
            this.init_ws()

            this.ws.connect()
        })
    }
    init_dom() {
        this.dom = Array.from([
            'container',
            'left',
            'right',
            'room_name',
            'room_users_count',
            'send_area'
        ]).reduce((r, k) => (r[k] = document.querySelector(`.${k}`), r), {})
        this.dom.send_area.addEventListener('keypress', (k) => {
            if (k.key === 'Enter') this.send_message()
        })

        document.querySelector('.send_button').addEventListener('click', (k) => this.send_message())
        window.onblur = () => this.background = true
        window.onfocus = () => {
            this.background = false
            clearInterval(this.blink_title)
            document.title = this.original_title
        }
        document.querySelector('.room_list').onclick = () => this.dom.send_area.focus()
        //document.querySelector('.messages').onclick = () => this.dom.send_area.focus()
        document.querySelector('.user_list').onclick = () => this.dom.send_area.focus()
        document.querySelectorAll('.menu_button').forEach(e => e.onclick = () => { this.load_modal(e.getAttribute('data-target')) })
        document.querySelector('.modal_background').onclick = () => this.close_modal()

        document.querySelector('.toggle_left').onclick = () => {
            this.left_side_visible = (this.left_side_visible) ? false : true
            this.render_grid()
        }
        document.querySelector('.toggle_right').onclick = () => {
            this.right_side_visible = (this.right_side_visible) ? false : true
            this.render_grid()
        }
        this.disable_autocomplete()
        this.render_grid()
    }
    render_grid() {
        if (!this.mobile) this.dom.container.style.gridTemplateAreas = `"${this.left_side_visible ? 'left' : 'center'} center ${this.right_side_visible ? 'right' : 'center'}"`
        this.dom.left.style.display = (this.left_side_visible) ? 'block' : 'none'
        this.dom.right.style.display = (this.right_side_visible) ? 'block' : 'none'
    }
    css_root_vars() {
        return document.styleSheets[0].cssRules[0].style.cssText.split(";").reduce((r, v) => {
            let k = v.split(':')[0].trim()
            if (k.substring(0, 2) !== '--') return r
            k = k.substring(2)
            r[k] = this.css_var(k)
            return r
        }, {})
    }
    css_var(name, value) {
        if (name.substring(0, 2) !== "--") name = "--" + name
        if (value) document.documentElement.style.setProperty(name, value)
        return getComputedStyle(document.documentElement).getPropertyValue(name)
    }
    close_modal() {
        document.querySelector('.modal').style.display = "none"
        this.dom.send_area.focus()
        setTimeout(() => {
            let el = document.querySelector('.messages')
            el.scrollTop = el.scrollHeight
        }, 1000)

    }
    load_modal(modal_template) {
        if (!modal_template) return false
        let modal_content = document.querySelector(`#${modal_template}_modal`)
        if (!modal_content) return false
        modal_content = modal_content.innerHTML
        let modal_content_element = document.querySelector('.modal_content')
        if (!modal_content_element) return false
        document.querySelector('.modal').style.display = "block"
        modal_content_element.innerHTML = modal_content
        modal_content_element.style.marginLeft = `calc(50% - ${modal_content_element.offsetWidth / 2}px)`
        this.disable_autocomplete()
        let inp = modal_content_element.querySelector('input')
        if (typeof this[`${modal_template}_modal`] === 'function') this[`${modal_template}_modal`](modal_content_element)
        if (inp) {
            inp.focus()
            inp.select()
        }
        modal_content_element.querySelectorAll('input').forEach(e => e.addEventListener('keypress', (k) => {
            if (k.key !== 'Enter') return
            document.querySelector('.modal').style.display = 'none'
            this.dom.send_area.focus()
        }))

    }
    init_ws() {
        this.ws.on('room.data', room => this.init_room(room))
        this.ws.on('room.join', data => {
            if (data.room === this.room?.name) {
                this.render_user(data.user)
                this.dom.room_users_count.innerHTML = `${this.room.users.size} users`
            }
        })
        this.ws.on('room.leave', data => {
            if (data.room === this.room?.name) {
                document.querySelector(`#user-${data.user}`)?.remove()
                this.dom.room_users_count.innerHTML = `${this.room.users.size} users`
            }
        })
        this.ws.on('room.left', room_name => this.remove_room(room_name))
        this.ws.on('user.nick', (data) => {
            let room = this.ws.rooms.get(data.room)
            if (!room) return false
            let user = room.users.get(data.id)
            if (!user) return false
            if (room.name === this.room?.name) this.render_user(user)
            if (user.id === this.ws.me.id) this.dom.send_area.placeholder = `You are typing as "${this.ws.me.nick}"`
        })

    }
    time() {
        let MyDate = new Date()
        return [('0' + MyDate.getHours()).slice(-2), ('0' + (MyDate.getMinutes() + 1)).slice(-2), ('0' + (MyDate.getSeconds() + 1)).slice(-2)].join(':')
    }
    template_item(template, destination) {
        let templet_item = document.querySelector(template).innerHTML
        let item = document.querySelector(destination).appendChild(document.createElement('div'))
        item.classList.add(template.replace('#', '').replace('.', ''))
        item.innerHTML = templet_item
        return item
    }
    format_id(txt) {
        return btoa(txt).split('=').join('-')
    }
    remove_room(room_name) {
        document.querySelector(`#room-${this.format_id(room_name)}`)?.remove()
        document.querySelectorAll('.room_item').forEach(item => item.querySelector('.name').style.color = "var(--border-color)")
        if (this.room.name !== room_name) return true
        document.querySelector('.user_list').innerHTML = ''

        this.room = this.ws.rooms.get(Array.from(this.ws.rooms.values()).slice(-1)[0]?.name)
        if (this.room) {
            document.querySelector(`#room-${this.format_id(this.room.name)}`).querySelector('.name').style.color = "var(--active-color)"
            this.dom.room_users_count.innerHTML = `${this.room.users.size} users`
        }
        this.render_users()
        this.render_messages()
    }
    init_room(room) {

        room.on('test', (data, user) => {
            console.log(user)
            console.log(data)
        })

        room.on('msg', (data, user) => {
            let msg = {
                time: this.time(),
                nick: user.nick,
                user: user.id,
                message: this.ws.strip_html(data.toString())
            }
            if (!msg.message) return false
            room.messages.push(msg)
            if (this.room?.name === room.name) this.render_message(msg)
            else {
                let r = document.querySelector(`#room-${this.format_id(room.name)}`)?.querySelector('.name')
                room.unread = true
                if (r) r.style.color = "var(--unread-color)"
            }
            if (this.background) {
                clearInterval(this.blink_title)
                this.blink_title = setInterval(() => {
                    if (document.title === this.original_title) document.title = 'New message'
                    else document.title = this.original_title
                }, 500)
            }
        })
        room.messages = []
        document.querySelector('.messages').innerHTML = ''
        let old_room = document.querySelector(`#room-${this.format_id(this.room?.name)}`)
        if (old_room) old_room.querySelector('.name').style.color = "var(--border-color)"
        this.room = room
        this.render_room(room)
        this.render_users()
    }
    render_room(room) {
        this.dom.room_name.innerHTML = this.room.name
        this.dom.room_users_count.innerHTML = `${this.room.users.size} users`

        let item = this.template_item('#room_item', '.room_list')
        item.querySelector('.name').innerHTML = room.name
        item.id = `room-${this.format_id(room.name)}`
        item.onclick = () => {
            room.unread = false
            let old_room = document.querySelector(`#room-${this.format_id(this.room?.name)}`)
            if (old_room) old_room.querySelector('.name').style.color = "var(--border-color)"
            item.querySelector('.name').style.color = "var(--active-color)"
            this.room = room
            this.dom.room_name.innerHTML = this.room.name
            this.dom.room_users_count.innerHTML = `${this.room.users.size} users`
            this.render_users()
            this.render_messages()
        }
        item.querySelector('.close').onclick = () => this.ws.signal('leave', room.name)
        if (room.name === this.room?.name) item.querySelector('.name').style.color = "var(--active-color)"
        else if (room.unread) item.querySelector('.name').style.color = "var(--unread-color)"
    }
    render_messages() {
        this.dom.send_area.focus()
        if (!this.room) return false
        document.querySelector('.messages').innerHTML = ''
        this.room.messages.map(m => this.render_message(m))
    }
    render_message(msg) {
        let item = this.template_item('#message_item', '.messages')
        Object.keys(msg).map(k => {
            let el = item.querySelector(`.${k}`)
            if (el) el.innerHTML = msg[k]
        })
        let el = document.querySelector('.messages')
        if (el) el.scrollTop = el.scrollHeight
    }
    send_message() {
        let msg = this.dom.send_area.value.trim()
        if (!msg) return
        if (msg.charAt(0) === '/') {
            const short_cuts = {
                '/j': '/join',
                '/l': '/leave',
                '/n': '/nick',
            }
            Object.keys(short_cuts).map(k => msg = msg.replace(`${k} `, `${short_cuts[k]} `))
            msg = msg.substring(1).split(' ')
            let cmd = msg.shift()
            msg = msg.join(' ')

            if (Object.values(short_cuts).find(v => v === `/${cmd}`)) {
                this.dom.send_area.value = ''
                this.ws.signal(cmd, msg)
            }
            else if (this.room) {
                this.room.send(cmd, msg)
                this.dom.send_area.value = ''
            }
        } else {
            if (!this.room) return false
            if (this.room.send('msg', msg)) this.dom.send_area.value = ''
        }
        return true
    }
    init(data) {
        this.dom.send_area.placeholder = `You are typing as "${this.ws.me.nick}"`
        this.main()
    }
    render_user(user) {
        let item = document.querySelector(`#user-${user.id}`) || this.template_item('#user_item', '.user_list')
        item.id = `user-${user.id}`
        item.querySelector('.name').innerHTML = user.nick
        if (user.id === this.ws.me.id) item.querySelector('.name').style.color = "var(--active-color)"
    }
    render_rooms() {
        document.querySelector('.room_list').innerHTML = ''
        this.ws.rooms.forEach(r => this.render_room(r))
    }
    render_users() {
        if (!this.room) return false
        document.querySelector('.user_list').innerHTML = ''
        this.room.users.forEach(u => this.render_user(u))
    }
    main() {
        this.dom.send_area.focus()
        this.css_root_vars()
    }

    //---- modal pages
    disable_autocomplete() {
        const inputs = document.querySelectorAll('input')
        inputs.forEach(input => {
            input.setAttribute('autocomplete', 'off')
            input.setAttribute('autocorrect', 'off')
            input.setAttribute('autocapitalize', 'off')
            input.setAttribute('spellcheck', false)
        })
    }
    settings_modal(modal) {
        let nick = modal.querySelector('.nick')
        nick.value = this.ws.me.nick
        let nick_change = () => {
            clearTimeout(modal.nick_change_timeout)
            let new_nick = nick.value
            modal.nick_change_timeout = setTimeout(() => this.ws.signal('nick', new_nick), 500)
        }
        nick.onchange = () => nick_change()
        nick.addEventListener('keyup', () => nick_change())
        //--css vars
        modal.appendChild(document.createElement('hr'))
        let vars = this.css_root_vars()
        Object.keys(vars).map(k => {
            let settings_item = this.template_item('#settings_css_var', '.modal_content')
            settings_item.querySelector('span').innerHTML = k
            let input = settings_item.querySelector('input')
            let f = () => this.css_var(k, input.value)
            if (k.indexOf('-color') !== -1) {
                input.type = 'color'
                input.addEventListener('input', () => f())
            } else if (k.indexOf('-range') !== -1) {
                vars[k] = parseInt(vars[k].replace('px', ''))
                input.type = 'range'
                if (k === 'zoom-range') {
                    input.max = 30
                    input.min = 10
                }
                input.style.height = '1px'
                f = () => this.css_var(k, `${input.value}px`)
                let span = document.createElement('span')
                span.innerHTML = 'px'
                //settings_item.appendChild(span)
            }
            input.value = vars[k]
            input.addEventListener('change', () => f())
            input.addEventListener('keyup', () => f())
        })
    }
    join_room_modal(modal) {
        let room_name = modal.querySelector('.room_name')
        room_name.addEventListener('keypress', (k) => {
            if (k.key === 'Enter') {
                this.ws.signal('join', room_name.value)
            }
        })
        modal.querySelector('.join').onclick = () => {
            this.ws.signal('join', room_name.value)
            this.close_modal()
        }
    }

}