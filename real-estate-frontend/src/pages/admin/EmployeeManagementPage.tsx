import { useEffect, useState } from "react";
import { Table, Button, Space, Modal, Form, Input, DatePicker, Popconfirm, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { employeeApi } from "@/api";

const EmployeeManagementPage = () => {

  const [data,setData] = useState<any[]>([]);
  const [loading,setLoading] = useState(false);
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try{
      const res = await employeeApi.getAll({page:1,limit:10});
      setData(res.data.data);
    }catch(err){
      message.error("Load employee failed");
    }
    setLoading(false);
  };

  useEffect(()=>{
    loadData();
  },[]);

  const openModal = (record?:any)=>{
    setEditing(record || null);
    form.resetFields();

    if(record){
      form.setFieldsValue({
        ...record,
        fullName:record.user?.fullName,
        email:record.user?.email,
        phone:record.user?.phone,
        startDate:record.startDate ? dayjs(record.startDate) : null
      });
    }

    setOpen(true);
  };

  const submit = async () => {

    const values = await form.validateFields();
  
    if (values.startDate) {
      values.startDate = values.startDate.format("YYYY-MM-DD");
    }
  
    try {
  
      if (editing) {
        await employeeApi.update(editing.id, values);
        message.success("Update success");
      } else {
        await employeeApi.create(values);
        message.success("Create success");
      }
  
      setOpen(false);
      loadData();
  
    } catch (err: any) {
  
      console.log("FULL ERROR:", err);
  
      if (err.response) {
        console.log("STATUS:", err.response.status);
        console.log("DATA:", err.response.data);
      }
  
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Save failed";
  
      message.error(errorMessage);
    }
  };

  const remove = async(id:number)=>{
    await employeeApi.delete(id);
    message.success("Disabled");
    loadData();
  };

  const columns = [
    {
      title:"Mã NV",
      dataIndex:"code"
    },
    {
      title:"Họ tên",
      render:(_:any,r:any)=>r.user?.fullName
    },
    {
      title:"Email",
      render:(_:any,r:any)=>r.user?.email
    },
    {
      title:"SĐT",
      render:(_:any,r:any)=>r.user?.phone
    },
    {
      title:"Ngày vào",
      render:(_:any,r:any)=>r.startDate ? dayjs(r.startDate).format("DD/MM/YYYY") : ""
    },
    {
      title:"Ngày tạo",
      render:(_:any,r:any)=>dayjs(r.createdAt).format("DD/MM/YYYY")
    },
    {
      title:"Hành động",
      render:(_:any,r:any)=>(
        <Space>
          <Button icon={<EditOutlined/>} onClick={()=>openModal(r)}/>
          <Popconfirm title="Delete?" onConfirm={()=>remove(r.id)}>
            <Button danger icon={<DeleteOutlined/>}/>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return(
    <div>

      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <h2>Quản lý nhân viên</h2>

        {/* GIỮ NGUYÊN NÚT THÊM MỚI */}
        <Button
          type="primary"
          icon={<PlusOutlined/>}
          onClick={()=>openModal()}
        >
          Thêm mới
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />

      <Modal
        title={editing ? "Sửa nhân viên" : "Thêm nhân viên"}
        open={open}
        onOk={submit}
        onCancel={()=>setOpen(false)}
      >

        <Form layout="vertical" form={form}>

          <Form.Item
            label="Mã NV"
            name="code"
            rules={[{required:true}]}
          >
            <Input/>
          </Form.Item>

          {!editing && (
            <>
              <Form.Item
                label="Username"
                name="username"
                rules={[{required:true}]}
              >
                <Input/>
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{required:true}]}
              >
                <Input.Password/>
              </Form.Item>
            </>
          )}

          <Form.Item
            label="Họ tên"
            name="fullName"
            rules={[{required:true}]}
          >
            <Input/>
          </Form.Item>

          <Form.Item label="Email" name="email">
            <Input/>
          </Form.Item>

          <Form.Item label="SĐT" name="phone">
            <Input/>
          </Form.Item>

          <Form.Item label="Ngày vào" name="startDate">
            <DatePicker style={{width:"100%"}}/>
          </Form.Item>

        </Form>

      </Modal>

    </div>
  );
};

export default EmployeeManagementPage;