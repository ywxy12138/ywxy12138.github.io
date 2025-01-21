`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    15:58:30 09/04/2024 
// Design Name: 
// Module Name:    cpu_checker 
// Project Name: 
// Target Devices: 
// Tool versions: 
// Description: 
//
// Dependencies: 
//
// Revision: 
// Revision 0.01 - File Created
// Additional Comments: 
//
//////////////////////////////////////////////////////////////////////////////////
`define S0 4'b0000//错误输入
`define S1 4'b0001//输入'^'
`define S2 4'b0010//在状态S1后输入十进制数
`define S3 4'b0011//输入'@'
`define S4 4'b0100//在S3后输入十六进制数
`define S5 4'b0101//输入':',输入空格后循环
`define S6 4'b0110//输入'$'，type变为1
`define S7 4'b0111//输入8'd42,type变为2
`define S8 4'b1000//在S6后输入十进制数grf
`define S9 4'b1001//在S7后输入十六进制数addr
`define S10 4'b1010//S8、S9输入空格后
`define S11 4'b1011//S8、S9、S10输入'<'后
`define S12 4'b1100//S11输入"="后
`define S13 4'b1101//S12输入十六进制数data
`define S14 4'b1110//S13输入"#"
module cpu_checker(
    input clk,
    input reset,
    input [7:0] char,
	input [15:0] freq,
    output [1:0] format_type,
	output [3:0] error_code
    );
    reg [3:0] status;//15种状态
	reg [3:0] cnt;//统计十进制数的位数
    reg [3:0] count;//统计十六进制数的位数
	reg [1:0] type;//第一个输出的指代
	reg time_code;//time是否正确的独热码
	reg pc_code;//pc是否正确的独热码
	reg grf_code;//grf是否正确的独热码
	reg addr_code;//addr是否正确的独热码
	reg [31:0] cur;//统计十进制数和十六进制数
	 always @(posedge clk) begin
	    if (reset == 1) begin
		     status <= `S0;
		     cnt <= 0;
		     count <= 0;
		     type <= 0;
		     time_code <= 0;
		     pc_code <= 0;
		     grf_code <= 0;
		     addr_code <= 0;
			  cur <= 0;
		end //初始化
		else begin
		    case (status) 
			    `S0 : begin
				    if (char == "^") begin
					   status <= `S1;//返回S1
						cnt <= 0;
					end
					else status <= `S0;
				end
				`S1 : begin
				    if (char >= "0" && char <= "9") begin //转到S2
						  cur <= (cur << 1) + (cur << 3) + char - "0";
                          cnt <= cnt + 1;
						  status <= `S2;
                    end
                    else if (char == "^") begin
						status <= `S1;
						cur <= 0;
						cnt <= 0;
					end
					else begin 
						status <= `S0;
						cur <= 0;
						cnt <= 0;
					end
                end
                `S2 : begin
                    if (char == "^") begin 
						  cur <= 0;
					      status <= `S1;
						  time_code <= 0;
						  cnt <= 0;
					end //转到S1
					else if ((char >= "0") && (char <= "9") && (cnt < 4)) begin
						  cur <= (cur << 1) + (cur << 3) + char - "0";
						  status <= `S2;
                    cnt <= cnt + 1;
					end //循环重复进行
					else if (char == "@") begin //转到S3
					      status <= `S3;
						  if ((cur & ((freq >> 1) - 1)) == 0) begin
							time_code <= 0;
						  end
						  else begin
							time_code <= 1;
						  end
						  cnt <= 0;
						  cur <= 0;
					end
					else begin
						  cur <= 0;						
					      status <= `S0;
						  time_code <= 0;
						  cnt <= 0;
					end
				end
				`S3 : begin
				    if (char == "^") begin
					      status <= `S1;
						  time_code <= 0;
						  count <= 0;
						  cur <= 0;
					end
					else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f")) begin
					      status <= `S4;
						  count <= count + 1;
						  cur <= (cur << 4) + ((char >= "0" && char <= "9") ? (char - "0") : (char - "a" + 10));
					end
					else  begin
						 status <= `S0;
						 time_code <= 0;
						 count <= 0;
						  cur <= 0;
					end
				end
				`S4 : begin
				   if (char == "^") begin 
					     cur <= 0;
						 status <= `S1;
						 time_code <= 0;
						 pc_code <= 0;
						 count <= 0;
					end
					else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f") && (count < 8)) begin
					     status <= `S4;
						  cur <= (cur << 4) + ((char >= "0" && char <= "9") ? (char - "0") : (char - "a" + 10));
						 count <= count + 1;
					end
					else if (char == ":" && count == 8) begin//读入:且count等于8
						 status <= `S5;
						 if ((cur >= 32'h0000_3000) && (cur <= 32'h0000_4fff) && ((cur & 3) == 0)) begin
						    pc_code <= 0;
						 end
						else begin 
							pc_code <= 1;
	 					 end
						 count <= 0;
						 cur <= 0;
						 end
					else begin//转到S0
					     cur <= 0;
						 status <= `S0;
						 time_code <= 0;
						 pc_code <= 0;
						 count <= 0;
					end
				end
				`S5 : begin
				  if (char == "^") begin
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     type <= 0;
						 count <= 0;
						 cnt <= 0;
				  end	
				  else if (char == " ") begin
				      status <= `S5;//空格循环
						count <= 0;
						cnt <= 0;
				 end
				  else if (char == "$") begin//读入"$"转到S6，type置1
				         status <= `S6;
					     type <= 1;
						 count <= 0;
						 cnt <= 0;
						 cur <= 0;
				  end
				  else if (char == 8'd42) begin//转到S7，type置2
				         status <= `S7;
					     type <= 2;
						 count <= 0;
						 cnt <= 0;
						 cur <= 0;
				  end
				  else begin 
				         status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
				         type <= 0;
						count <= 0;
						 cnt <= 0;
				  end
				end
				`S6 : begin
				   if (char == "^") begin
                         status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
                         type <= 0;
						 cnt <= 0;
						 cur <= 0;
						 count <= 0;
                   end
				   else if ((char >= "0") && (char <= "9")) begin//读入十进制数转到S8
					     status <= `S8;
						  cur <= ({cur[30:0],0} + {cur[28:0],3'b000} + (char - "0"));
                         cnt <= cnt + 1;
				   end
				   else begin
					     status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     type <= 0;
						 cnt <= 0;
						 cur <= 0;
						 count <= 0;
				   end
				end
				`S7 : begin
				   if (char == "^") begin 
                         status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
                         type <= 0;
						 cur <= 0;
						 count <= 0;
                   end
				   else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f")) begin//读入十六进制数转到S9
					     status <= `S9;
						 cur <= (cur << 4) + ((char >= "0" && char <= "9") ? (char - "0") : (char - "a" + 10));
					     count <= count + 1;
				   end
				   else begin
					     status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     type <= 0;
					     count <= 0;
						 cur <= 0;
				   end
				end
				`S8 : begin
				   if (char == "^") begin
					     cur <= 0;
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     type <= 0;
					     cnt <= 0;
				   end
				   else if ((char >= "0") && (char <= "9") && (cnt < 4)) begin
				         status <= `S8;
						   cur <= ({cur[30:0],0} + {cur[28:0],3'b000} + (char - "0"));
                         cnt <= cnt + 1;
				   end
				   else if (char == "<") begin //读入"<"转到S11
						 status <= `S11;
                         if((cur >= 0) && (cur <= 31)) begin
							grf_code <= 0;
						 end
					     else begin
							grf_code <= 1;
						end
				         cnt <= 0;
						 cur <= 0;
				   end
				   else if (char == " ") begin
					     cur <= 0;
						 status <= `S10;
					     cnt <= 0;
				   end
				   else begin
	                     cur <= 0;				
					     status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     cnt <= 0;
					     type <= 0;
				   end
			   end
			  `S9 : begin
			      if (char == "^") begin 
					     cur <= 0;				
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     count <= 0;
					     type <= 0;
				  end
				  else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f") && (count < 8)) begin//读到十六进制数循环直到读入了8位
					    cur <= (cur << 4) + ((char >= "0" && char <= "9") ? (char - "0") : (char - "a" + 10));
						 status <= `S9;
				         count <= count + 1;
				  end
				  else if (char == "<" && count == 8) begin//读到"<"且读入了8位数，转到S11
						 status <= `S11;
					     if((cur >= 32'h0000_0000) && (cur <= 32'h0000_2fff) && ((cur & 3) ==0)) begin
						    addr_code <= 0;
						 end
					     else begin
						    addr_code <= 1;
						 end
					     count <= 0;
						  cur <= 0;
				  end
				  else if (char == " " && count == 8) begin//读入空格转到S10
					     status <= `S10;
				  end
				  else begin
					     status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     count <= 0;
					     type <= 0;
					     cur <= 0;
						 addr_code <= 0;
				  end
				end
				`S10 : begin
				   if (char == "^") begin 
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
					     type <= 0;
				   end
                   else if (char == " ") begin//读到空格一直循环
                	     status <= `S10;
                   end
                   else if (char == "<") status <= `S11;
                   else begin
                         status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
                         type <= 0;
                   end
                end
                `S11 : begin
                   if (char == "^") begin 
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
					     type <= 0;
				   end
                   else if (char == "=") begin
						   status <= `S12;
							count <= 0;
						end
                   else begin 
                         status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
                         type <= 0;
                   end
                end
                `S12 : begin
           		   if (char == "^") begin 
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
					     type <= 0;
						 count <= 0;
				   end
                   else if (char == " ") status <= `S12;
                   else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f")) begin
                         status <= `S13;
                         count <= count + 1;
                   end
                   else begin 
                         status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
                         type <= 0;
                         count <= 0;
                   end
                end
                `S13 : begin	
                    if (char == "^") begin 
					     status <= `S1;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
				        count <= 0;
					     type <= 0;
					end
					else if ((char >= "0" && char <= "9") || (char >= "a" && char <= "f") && (count < 8)) begin
					     status <= `S13;
					     count <= count + 1;
					end
					else if ((char == "#") && (count == 8)) begin
					     status <= `S14;
					     count <= 0;
					end
					else begin
					     status <= `S0;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
					     count <= 0;
					     type <= 0;
					end
				end
                `S14 : begin
			        if (char == "^") begin 
					     status <= `S1;
						  type <= 0;
					     pc_code <= 0;
					     time_code <= 0;
					     grf_code <= 0;
					     addr_code <= 0;
						   cur <= 0;
								 cnt <= 0;
								 count <= 0;
				    end
					else begin 
                         status <= `S0;
								 type <= 0;
					          pc_code <= 0;
					          time_code <= 0;
					          grf_code <= 0;
					          addr_code <= 0;
								 cur <= 0;
								 cnt <= 0;
								 count <= 0;
                    end
				end
			 endcase
			end
	end
	assign format_type = (status == `S14) ? type : 2'b0;
	assign error_code = (status == `S14) ? {grf_code,addr_code,pc_code,time_code} : 4'b0000;			
endmodule
